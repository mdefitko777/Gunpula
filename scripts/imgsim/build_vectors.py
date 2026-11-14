"""Hobby Atlas "생김새로 찾기" — embed every catalog product's official image(s) with the same LiteRT model(s) the app
runs, and write one compact vectors file per model (imgsim_lib.MODELS: B/32 → imgsim-vectors.bin, B/16 → its own).

Rows (imgsim_lib.gallery_rows): per product in data/split/kits-*.json the cover and, when different, the atlas box art
or the 2nd local gallery image; the app keeps the best of a product's rows. Every row carries its franchise (`fr`) so
the app can search one franchise without loading the catalog.

Incremental: a row whose image URL was embedded before (by the same model) is copied from the previous file, so a
daily run only downloads new / changed images, and an image is downloaded once for all models that need it. Downloads
are polite: HobbyAtlasDataBot UA, one thread per host, ≥ 1.1 s between requests to a host, robots.txt obeyed, a host
that answers 403 / 429 / 503, an HTML page or a redirect to another host is left for the rest of the run, local
./assets images are read from the checkout. Images are only held in memory, never stored. With --budget-min the run
stops fetching after that many minutes and writes what it has (the next run fills the rest; a kit whose new image is
not read yet keeps its previous vector); images the B/32 file (installed apps) still lacks are fetched before the B/16
backfill.

An unchanged index is written byte for byte as before (same `updated`), so its sha256 and the manifests stay put.

usage: build_vectors.py REPO DIR OUT_DIR [--budget-min N] [--only ID,ID]
  DIR: the release assets (model .tflite files + previous vectors files); OUT_DIR gets <vectors> + <vectors>.summary.json
"""
import argparse
import collections
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from urllib.parse import urlparse

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imgsim_lib import (  # noqa: E402
    FRANCHISES, LEGACY_MODEL, MODELS, UA, assemble, fetch_url, gallery_rows, is_local, pack_stable, resolve_aliases,
    src_hash, unpack_vectors,
)

STOP_CODES = (403, 429, 503)
HOST_GAP_S = 1.1  # AGENTS.md: at least 1.1 s between two requests to one host

ap = argparse.ArgumentParser()
ap.add_argument('repo')
ap.add_argument('dir')
ap.add_argument('out_dir')
ap.add_argument('--budget-min', type=float, default=0)
ap.add_argument('--only', default='')
args = ap.parse_args()
t_start = time.time()
os.makedirs(args.out_dir, exist_ok=True)


def load(rel):
    with open(os.path.join(args.repo, rel), encoding='utf-8') as f:
        return json.load(f)


# ── gallery ─────────────────────────────────────────────────────────────────────────────────────
split = {fr: load(f'data/split/kits-{fr}.json')['kits'] for fr in FRANCHISES}
rows = gallery_rows(split, load('data/atlas/gundam-boxart.json').get('boxart', {}))
gallery_kits = len({r[0] for r in rows})
current_id = resolve_aliases(load('data/split/kit-aliases.json').get('aliases', {}))
print('gallery rows', len(rows), 'kits', gallery_kits, flush=True)

# ── models + previous files ─────────────────────────────────────────────────────────────────────
try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    from tensorflow.lite.python.interpreter import Interpreter

only = {m for m in args.only.split(',') if m}
models = {}  # id → interpreter, lock, reuse {src hash: (scale, vec bytes)}, prev_rows {kit: …}, previous bytes, done
for mid, spec in MODELS.items():
    path = os.path.join(args.dir, spec['file'])
    if only and mid not in only:
        continue
    if not os.path.exists(path):
        print(mid, 'skipped: no model file', flush=True)
        continue
    interp = Interpreter(model_path=path, num_threads=os.cpu_count() or 2)
    interp.allocate_tensors()
    outp = interp.get_output_details()[0]
    m = dict(interp=interp, inp=interp.get_input_details()[0], outp=outp, dim=int(outp['shape'][-1]),
             lock=threading.Lock(), size=spec['size'], reuse={}, prev_rows=collections.defaultdict(list), prev=None,
             done={})
    prev_path = os.path.join(args.dir, spec['vectors'])
    if os.path.exists(prev_path):
        with open(prev_path, 'rb') as f:
            m['prev'] = f.read()
        try:
            meta, dim, scales, vecs = unpack_vectors(m['prev'])
            # keyed by image, not by (kit, image): a renamed kit keeps its vector without a new download
            if meta.get('model') == mid and dim == m['dim']:
                m['reuse'] = {h: (s, v) for h, s, v in zip(meta['src'], scales, vecs)}
                for kid, h, s, v in zip(meta['ids'], meta['src'], scales, vecs):
                    m['prev_rows'][current_id.get(kid, kid)].append((h, s, v))
        except Exception as e:  # a broken / old file just means a full run
            print(mid, 'previous file ignored:', repr(e)[:200], flush=True)
    models[mid] = m
    print(mid, 'previous images reusable', len(m['reuse']), flush=True)
if not models:
    sys.exit('no model file in ' + args.dir)


# ── embedding ───────────────────────────────────────────────────────────────────────────────────
def prep(data, size):
    """Same steps as the app (lib/ml/visual_index.dart cropToInput): alpha on white → shorter side → center crop → [0, 1]."""
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        im = bg
    im = im.convert('RGB')
    im.thumbnail((320, 320), Image.LANCZOS)  # catalog images vary a lot in size; the eval gallery was ≤ 320 px
    w, h = im.size
    s = size / min(w, h)
    im = im.resize((max(size, round(w * s)), max(size, round(h * s))), Image.BICUBIC)
    l, t = (im.width - size) // 2, (im.height - size) // 2
    im = im.crop((l, t, l + size, t + size))
    return np.asarray(im, np.float32)[None] / 255.0


def embed(m, x):
    with m['lock']:
        m['interp'].set_tensor(m['inp']['index'], x)
        m['interp'].invoke()
        y = m['interp'].get_tensor(m['outp']['index'])[0].astype(np.float32)
    y /= np.linalg.norm(y) + 1e-12
    s = float(np.abs(y).max()) / 127 or 1.0
    return s, np.clip(np.round(y / s), -127, 127).astype(np.int8).tobytes()


# ── what to fetch ───────────────────────────────────────────────────────────────────────────────
need = {}  # url → model ids that have no vector for it yet
for _, u, _ in rows:
    mids = [mid for mid, m in models.items() if src_hash(u) not in m['reuse']]
    if mids:
        need[u] = mids
jobs = collections.defaultdict(list)
for u, mids in need.items():
    jobs['LOCAL' if is_local(u) else urlparse(u).netloc].append((u, mids))
for lst in jobs.values():
    lst.sort(key=lambda j: LEGACY_MODEL not in j[1])  # installed apps' file first, then the backfill
print('to embed', {mid: sum(mid in v for v in need.values()) for mid in models}, flush=True)
print({h: len(lst) for h, lst in jobs.items()}, flush=True)

# ── polite fetch ────────────────────────────────────────────────────────────────────────────────
class SameHostRedirects(urllib.request.HTTPRedirectHandler):
    """A jump to another host (a waiting room, a login) counts as a refusal and is not followed: that host's robots.txt
    was never read (scripts/lib/polite-fetch.mjs, 2026-11-14). No image host redirected on 2026-11-14."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).netloc != urlparse(req.full_url).netloc:
            raise urllib.error.HTTPError(newurl, 403, 'redirect to another host', headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(SameHostRedirects)
robots = {}
robots_read_at = {}  # netloc → when its robots.txt was read: that request counts for the 1.1 s gap too


def allowed(u):
    p = urlparse(u)
    host = f'{p.scheme}://{p.netloc}'
    if host not in robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(host + '/robots.txt', headers={'User-Agent': UA})
            with OPENER.open(req, timeout=20) as r:
                rp.parse(r.read().decode('utf-8', 'replace').splitlines())
        except urllib.error.HTTPError as e:
            rp.parse([] if e.code in (404, 410) else ['User-agent: *', 'Disallow: /'])
        except Exception:
            rp.parse([])
        robots[host] = rp
        robots_read_at[p.netloc] = time.time()
    return robots[host].can_fetch(UA, u)


def local_bytes(u):
    path = u[2:] if u.startswith('./') else u
    while path.startswith('../'):
        path = path[3:]
    path = path if path.startswith('app/') else 'app/' + path
    with open(os.path.join(args.repo, path), 'rb') as f:
        return f.read()


fails = collections.Counter()
stopped = threading.Event()
refused = {}  # host → why it was left for the rest of the run


def over_budget():
    return args.budget_min and time.time() - t_start > args.budget_min * 60


def worker(host, lst):
    last = 0.0
    for u, mids in lst:
        if over_budget():
            stopped.set()
            return
        try:
            if host == 'LOCAL':
                data = local_bytes(u)
            else:
                wire = fetch_url(u)
                if not allowed(wire):
                    fails['robots'] += 1
                    continue
                wait = max(last, robots_read_at.get(host, 0.0)) + HOST_GAP_S - time.time()
                if wait > 0:
                    time.sleep(wait)
                last = time.time()
                req = urllib.request.Request(wire, headers={'User-Agent': UA})
                with OPENER.open(req, timeout=30) as r:
                    if r.headers.get_content_type() == 'text/html':  # a bot check or an error page, not an image
                        refused[host] = 'html'
                        return
                    data = r.read()
            for mid in mids:
                m = models[mid]
                m['done'][src_hash(u)] = embed(m, prep(data, m['size']))
        except urllib.error.HTTPError as e:
            fails[f'HTTP {e.code}'] += 1
            if e.code in STOP_CODES:
                refused[host] = e.code
                return
        except Exception as e:
            fails[type(e).__name__] += 1


threads = [threading.Thread(target=worker, args=(h, lst), daemon=True) for h, lst in jobs.items()]
for t in threads:
    t.start()
while any(t.is_alive() for t in threads):
    time.sleep(30)
    print(time.strftime('%H:%M:%S'), 'embedded', {mid: len(m['done']) for mid, m in models.items()},
          'fails', dict(fails), flush=True)
if refused:
    print('hosts left for this run:', refused, flush=True)

# ── write ───────────────────────────────────────────────────────────────────────────────────────
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for mid, m in models.items():
    ids, src, fr, scales, vecs, kept = assemble(
        rows, lambda u: m['done'].get(src_hash(u)) or m['reuse'].get(src_hash(u)), m['prev_rows'])
    data, changed = pack_stable(m['prev'], mid, now, m['dim'], ids, src, fr, scales, vecs)
    out = os.path.join(args.out_dir, MODELS[mid]['vectors'])
    with open(out + '.tmp', 'wb') as f:
        f.write(data)
    os.replace(out + '.tmp', out)
    by_fr = collections.Counter(FRANCHISES[fi] for fi in dict(zip(ids, fr)).values())
    kits = len(set(ids))
    summary = dict(
        model=mid,
        rows=len(ids),
        kits=kits,
        gallery_rows=len(rows),
        gallery_kits=gallery_kits,
        coverage=round(kits / gallery_kits, 4) if gallery_kits else 0,
        kits_by_franchise={f: by_fr[f] for f in FRANCHISES},
        updated=unpack_vectors(data)[0]['updated'],
        changed=changed,
        new=len(m['done']),
        kept_previous=kept,
        fails=dict(fails),
        refused=refused,
        stopped_by_budget=stopped.is_set(),
        bytes=len(data),
        minutes=round((time.time() - t_start) / 60, 1),
    )
    print(json.dumps(summary), flush=True)
    with open(out + '.summary.json', 'w') as f:
        json.dump(summary, f)
