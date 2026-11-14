// scripts/lib/polite-fetch.mjs on a stub server: robots.txt first, the bot's user agent, the gap
// between requests, redirects followed by hand and a refusing host left alone for the run.
//   node scripts/test_polite_fetch.mjs
import assert from "node:assert/strict";
import { BOT_USER_AGENT, createPoliteFetcher } from "./lib/polite-fetch.mjs";

function stubSite(pages) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, at: Date.now(), userAgent: init.headers?.["User-Agent"], redirect: init.redirect });
    const page = pages[url] || { status: 404, body: "" };
    return new Response(page.body ?? "", { status: page.status ?? 200, headers: page.headers || {} });
  };
  return { calls, fetchImpl };
}

const quiet = () => {};
const ROBOTS = { status: 200, body: "User-agent: *\nDisallow: /private\n" };

// robots.txt before the first page, once per host; the bot's user agent on every request.
{
  const site = stubSite({
    "https://a.test/robots.txt": ROBOTS,
    "https://a.test/one": { body: "one" },
    "https://a.test/two": { body: "two" },
  });
  const fetcher = createPoliteFetcher({ fetchImpl: site.fetchImpl, gapMs: 40, log: quiet });
  assert.equal(await fetcher.text("https://a.test/one"), "one");
  assert.equal(await fetcher.text("https://a.test/two"), "two");
  assert.deepEqual(site.calls.map((call) => call.url), ["https://a.test/robots.txt", "https://a.test/one", "https://a.test/two"]);
  assert.ok(site.calls.every((call) => call.userAgent === BOT_USER_AGENT));
  for (let i = 1; i < site.calls.length; i += 1) assert.ok(site.calls[i].at - site.calls[i - 1].at >= 35, "one request per gap");
  await assert.rejects(fetcher.text("https://a.test/private/x"), /disallowed by robots\.txt/);
  assert.equal(site.calls.length, 3, "a disallowed page is never requested");
}

// A same-host redirect is followed after the robots.txt check of its new path.
{
  const site = stubSite({
    "https://a.test/robots.txt": ROBOTS,
    "https://a.test/old": { status: 301, headers: { Location: "/new" } },
    "https://a.test/new": { body: "new" },
    "https://a.test/hidden": { status: 302, headers: { Location: "/private/page" } },
  });
  const fetcher = createPoliteFetcher({ fetchImpl: site.fetchImpl, gapMs: 1, log: quiet });
  assert.equal(await fetcher.text("https://a.test/old"), "new");
  assert.ok(site.calls.filter((call) => !call.url.endsWith("/robots.txt")).every((call) => call.redirect === "manual"));
  await assert.rejects(fetcher.text("https://a.test/hidden"), /disallowed by robots\.txt/);
  assert.ok(!site.calls.some((call) => call.url.includes("/private/")));
}

// A redirect to another host (a waiting room) is not requested, and the host gets nothing more.
{
  const site = stubSite({
    "https://store.test/robots.txt": ROBOTS,
    "https://store.test/item": { status: 302, headers: { Location: "https://queue.test/?c=store" } },
    "https://store.test/other": { body: "other" },
  });
  const fetcher = createPoliteFetcher({ fetchImpl: site.fetchImpl, gapMs: 1, log: quiet });
  await assert.rejects(fetcher.text("https://store.test/item"), /was sent to https:\/\/queue\.test\//);
  assert.ok(!site.calls.some((call) => call.url.startsWith("https://queue.test")));
  await assert.rejects(fetcher.text("https://store.test/other"), /stopped this run/);
  assert.equal(site.calls.length, 2);
}

// 403 / 429 / 503 and bot checks stop the host; a 404 does not.
for (const page of [{ status: 403 }, { status: 429 }, { status: 503 }, { body: "<title>Just a moment...</title>" }]) {
  const site = stubSite({
    "https://a.test/robots.txt": ROBOTS,
    "https://a.test/refused": page,
    "https://a.test/next": { body: "next" },
  });
  const fetcher = createPoliteFetcher({ fetchImpl: site.fetchImpl, gapMs: 1, log: quiet });
  await assert.rejects(fetcher.text("https://a.test/refused"));
  await assert.rejects(fetcher.text("https://a.test/next"), /stopped this run/);
  assert.ok(!site.calls.some((call) => call.url === "https://a.test/next"));
}
{
  const site = stubSite({ "https://a.test/robots.txt": ROBOTS, "https://a.test/next": { body: "next" } });
  const fetcher = createPoliteFetcher({ fetchImpl: site.fetchImpl, gapMs: 1, log: quiet });
  await assert.rejects(fetcher.text("https://a.test/gone"), /HTTP 404/);
  assert.equal(await fetcher.text("https://a.test/next"), "next");
}

console.log("test_polite_fetch: ok");
