#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "pbandai_sources.json"
OUTPUT_PATH = ROOT / "data" / "pbandai.json"
CACHE_DIR = ROOT / "work" / "pbandai_cache"


class BlockedError(Exception):
    pass


class FetchError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def cache_path(url: str) -> Path:
    return CACHE_DIR / f"{hashlib.sha1(url.encode('utf-8')).hexdigest()}.html"


def is_fresh(path: Path, hours: int) -> bool:
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
    return datetime.now(timezone.utc) - mtime < timedelta(hours=hours)


def looks_blocked(text: str, final_url: str) -> bool:
    haystack = f"{final_url}\n{text[:20000]}".lower()
    patterns = [
        "global_newpc.html",
        "access denied",
        "forbidden",
        "not available in your region",
        "captcha",
        "ご利用いただけません",
        "アクセスが集中",
        "お住まいの地域",
        "海外からのアクセス",
    ]
    return any(pattern.lower() in haystack for pattern in patterns)


def fetch_text(url: str, *, force: bool, retries: int, timeout: int, cache_hours: int) -> tuple[str, str]:
    path = cache_path(url)
    if not force and is_fresh(path, cache_hours):
        return path.read_text(encoding="utf-8", errors="replace"), url

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    headers = {
        "User-Agent": "GunpulaPBandaiCrawler/1.0 (+https://github.com/mdefitko777/Gunpula)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.4",
    }
    last_error = ""
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers=headers)
            with urlopen(request, timeout=timeout) as response:
                raw = response.read(4_000_000)
                charset = response.headers.get_content_charset() or "utf-8"
                text = raw.decode(charset, errors="replace")
                final_url = response.geturl()
                if looks_blocked(text, final_url):
                    raise BlockedError(f"Premium Bandai appears blocked or redirected: {final_url}")
                path.write_text(text, encoding="utf-8")
                return text, final_url
        except HTTPError as error:
            body = error.read(200000).decode("utf-8", errors="replace")
            if error.code in {401, 403, 451} or looks_blocked(body, error.url or url):
                raise BlockedError(f"HTTP {error.code}: Premium Bandai blocked this request")
            last_error = f"HTTP {error.code}: {error.reason}"
        except BlockedError:
            raise
        except (TimeoutError, URLError, OSError) as error:
            last_error = str(error)

        if attempt < retries:
            time.sleep(2 + attempt)

    raise FetchError(last_error or "request failed")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def meta_content(text: str, key: str) -> str:
    for tag in re.findall(r"<meta\s+[^>]+>", text, flags=re.I):
        attrs = dict(re.findall(r'([\w:-]+)\s*=\s*["\']([^"\']*)["\']', tag))
        if attrs.get("property") == key or attrs.get("name") == key:
            return clean_text(attrs.get("content", ""))
    return ""


def page_title(text: str) -> str:
    title = meta_content(text, "og:title") or meta_content(text, "twitter:title")
    if not title:
        match = re.search(r"<title[^>]*>(.*?)</title>", text, flags=re.I | re.S)
        title = clean_text(match.group(1) if match else "")
    return re.sub(r"\s*\|\s*プレミアムバンダイ.*$", "", title).strip()


def page_image(text: str, final_url: str) -> str:
    image = meta_content(text, "og:image") or meta_content(text, "twitter:image")
    return urljoin(final_url, image) if image else ""


def page_price(text: str) -> str:
    compact = clean_text(text)
    match = re.search(r"[¥￥]\s*([0-9][0-9,]*)", compact)
    if match:
        return f"¥{match.group(1)}"
    match = re.search(r"([0-9][0-9,]*)\s*円", compact)
    return f"¥{match.group(1)}" if match else ""


def page_status(text: str) -> str:
    compact = clean_text(text)
    for status in ["予約受付中", "予約終了", "販売中", "販売終了", "抽選販売", "在庫なし", "準備数に達しました"]:
        if status in compact:
            return status
    return ""


def item_id(url: str) -> str:
    match = re.search(r"/item/(item-\d+)/?", url)
    if match:
        return match.group(1)
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def product_links(text: str, final_url: str) -> list[str]:
    links = []
    for match in re.finditer(r'(?:https?://p-bandai\.jp)?/item/item-\d+/?', text):
        links.append(urljoin(final_url, match.group(0)))
    return list(dict.fromkeys(links))


def product_from_page(source: dict, url: str, text: str, final_url: str, status: str = "ok", message: str = "") -> dict:
    title = page_title(text)
    return {
        "id": item_id(final_url or url),
        "title": title or url,
        "price": page_price(text),
        "status": page_status(text),
        "image": page_image(text, final_url or url),
        "url": final_url or url,
        "source": source.get("source") or "premium_bandai_jp",
        "category": source.get("category") or "",
        "updated_at": now_iso(),
        "fetch_status": status,
        "error_message": message,
    }


def status_item(source: dict, url: str, status: str, message: str) -> dict:
    return {
        "id": item_id(url),
        "title": source.get("title") or url,
        "price": source.get("price") or "",
        "status": source.get("status") or "",
        "image": source.get("image") or "",
        "url": url,
        "source": source.get("source") or "premium_bandai_jp",
        "category": source.get("category") or "",
        "updated_at": now_iso(),
        "fetch_status": status,
        "error_message": message,
    }


def crawl_source(source: dict, args) -> list[dict]:
    url = source.get("url")
    if not url:
        return []

    try:
        text, final_url = fetch_text(url, force=args.force, retries=args.retries, timeout=args.timeout, cache_hours=args.cache_hours)
    except BlockedError as error:
        return [status_item(source, url, "blocked", str(error))]
    except FetchError as error:
        return [status_item(source, url, "error", str(error))]

    if re.search(r"/item/item-\d+/?", final_url):
        return [product_from_page(source, url, text, final_url)]

    links = product_links(text, final_url)
    if not links:
        return [product_from_page(source, url, text, final_url)]

    items = []
    for link in links[: args.max_items_per_source]:
        time.sleep(args.delay)
        try:
            item_text, item_final_url = fetch_text(link, force=args.force, retries=args.retries, timeout=args.timeout, cache_hours=args.cache_hours)
            items.append(product_from_page(source, link, item_text, item_final_url))
        except BlockedError as error:
            items.append(status_item(source, link, "blocked", str(error)))
        except FetchError as error:
            items.append(status_item(source, link, "error", str(error)))
    return items


def merge_manual_items(new_items: list[dict]) -> list[dict]:
    existing_doc = read_json(OUTPUT_PATH, {})
    existing_items = existing_doc if isinstance(existing_doc, list) else existing_doc.get("items", [])
    merged = {item.get("id") or item.get("url"): item for item in new_items if item.get("id") or item.get("url")}
    for item in existing_items:
        key = item.get("id") or item.get("url")
        if item.get("manual") and key:
            current = merged.get(key)
            if not current or current.get("fetch_status") != "ok":
                merged[key] = item
    return list(merged.values())


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Premium Bandai Japan pages into data/pbandai.json.")
    parser.add_argument("--force", action="store_true", help="Ignore cached HTML.")
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--cache-hours", type=int, default=6)
    parser.add_argument("--max-items-per-source", type=int, default=50)
    args = parser.parse_args()

    sources = read_json(SOURCES_PATH, [])
    if not isinstance(sources, list):
        raise SystemExit(f"{SOURCES_PATH} must be a JSON array")

    items = []
    for source in sources:
        items.extend(crawl_source(source, args))
        time.sleep(args.delay)

    payload = {
        "schema_version": 1,
        "source": "premium_bandai_jp",
        "updated_at": now_iso(),
        "items": merge_manual_items(items),
    }
    write_json(OUTPUT_PATH, payload)
    print(f"Wrote {len(payload['items'])} Premium Bandai records to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
