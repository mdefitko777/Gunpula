// Unit checks for the weekly image refresh: the picture fetcher of cache_catalog_images.mjs
// (lib/image-fetcher.mjs: a refusing host is asked once per run, in both modes) and the hand-kept
// list of records without a usable picture that check_image_health.mjs honours (lib/image-gaps.mjs,
// data/image-gaps.json). A fake fetch, no network.
//   node scripts/test_image_health.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BOT_UA, createImageFetcher, hostAllowed, hostList } from "./lib/image-fetcher.mjs";
import { loadImageGaps, sortImageGaps } from "./lib/image-gaps.mjs";

const PCO = "https://www.pokemoncenter-online.com/static/product_image/4521329403533/4521329403533_L.jpg";
const SHOP = "https://shopby-images.cdn-nhncommerce.com/Mall-No-h6Ss/20261112/175231.770171169/4521329369600.jpg";

// ── --host / --skip-host ──
assert.deepEqual([...hostList(" www.pokemoncenter-online.com, ,a.example")], ["www.pokemoncenter-online.com", "a.example"]);
const skipPco = { skip: hostList("www.pokemoncenter-online.com") };
assert.equal(hostAllowed(PCO, skipPco), false, "cache:pokemon-images leaves Pokémon Center to the polite run");
assert.equal(hostAllowed(SHOP, skipPco), true);
assert.equal(hostAllowed(SHOP, { only: hostList("www.pokemoncenter-online.com") }), false);
assert.equal(hostAllowed(PCO, { only: hostList("www.pokemoncenter-online.com") }), true);
assert.equal(hostAllowed(SHOP), true);

// ── a refusing host gets no second request in the run ──
function fakeFetch(answers) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} });
    const { status = 200, type = "image/jpeg", body = "" } = answers(url);
    return new Response(status === 204 ? null : body, { status, headers: { "content-type": type } });
  };
  return { impl, calls };
}

async function refusedTwice(fetcher, url) {
  const first = await fetcher.fetch(url);
  await assert.rejects(fetcher.fetch(url.replace("_L", "_01_L")), (error) => error.hostRefused === new URL(url).host);
  return first;
}

{
  // The old run (browser user-agent, Referer) used to ask once per record: three 403s on 2026-11-15.
  const { impl, calls } = fakeFetch((url) => (url.includes("pokemoncenter") ? { status: 403, type: "text/html" } : {}));
  const fetcher = createImageFetcher({ polite: false, userAgent: "OldUA", fetchImpl: impl });
  const first = await refusedTwice(fetcher, PCO);
  assert.equal(first.status, 403);
  assert.equal(calls.length, 1, "one request to the refusing host");
  assert.equal(fetcher.refused("www.pokemoncenter-online.com"), "HTTP 403");
  assert.equal((await fetcher.fetch(SHOP, { referer: "https://pokemonstore.co.kr/" })).status, 200, "other hosts go on");
  assert.equal(calls[1].headers["User-Agent"], "OldUA");
  assert.equal(calls[1].headers.Referer, "https://pokemonstore.co.kr/");
  assert.equal(fetcher.refused("shopby-images.cdn-nhncommerce.com"), null);
}
{
  // A 404 is one missing picture, not the host asking us to stop.
  const { impl, calls } = fakeFetch(() => ({ status: 404, type: "text/html" }));
  const fetcher = createImageFetcher({ polite: false, userAgent: "OldUA", fetchImpl: impl });
  assert.equal((await fetcher.fetch(SHOP)).status, 404);
  assert.equal((await fetcher.fetch(SHOP)).status, 404);
  assert.equal(calls.length, 2);
}
{
  // Polite: robots.txt first, the bot's name, no Referer, then the same stop.
  const { impl, calls } = fakeFetch((url) =>
    url.endsWith("/robots.txt") ? { status: 404, type: "text/html" } : { status: 403, type: "text/html" },
  );
  const fetcher = createImageFetcher({ polite: true, gapMs: 1, fetchImpl: impl });
  await refusedTwice(fetcher, PCO);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ["/robots.txt", new URL(PCO).pathname]);
  assert.equal(calls[1].headers["User-Agent"], BOT_UA);
  assert.equal(calls[1].headers.Referer, undefined);
}
{
  // Polite: a page in place of a picture (a bot check) stops the host too; robots.txt is obeyed.
  const { impl, calls } = fakeFetch((url) =>
    url.endsWith("/robots.txt")
      ? { type: "text/plain", body: "User-agent: *\nDisallow: /private/\n" }
      : { type: "text/html", body: "<html>checking your browser</html>" },
  );
  const fetcher = createImageFetcher({ polite: true, gapMs: 1, fetchImpl: impl });
  await assert.rejects(fetcher.fetch("https://a.example/private/x.jpg"), /robots\.txt disallows/);
  await refusedTwice(fetcher, "https://a.example/img/x_L.jpg");
  assert.equal(calls.length, 2, "robots.txt and one picture");
}

// ── known gaps: listed records do not fail the check, others do ──
const missing = [
  { kit_id: "pokemon-kr-116548761", urls: [PCO] },
  { kit_id: "pokemon-kr-999", urls: [] },
];
const sorted = sortImageGaps({
  missing,
  checkedIds: new Set(["pokemon-kr-116548761", "pokemon-kr-999", "pokemon-kr-133826295"]),
  catalogIds: new Set(["pokemon-kr-116548761", "pokemon-kr-999", "pokemon-kr-133826295", "fate-1"]),
  gaps: { "pokemon-kr-116548761": "hotlink", "pokemon-kr-133826295": "godo", "fate-1": "x", "pokemon-kr-gone": "y" },
});
assert.deepEqual(sorted.failing.map((item) => item.kit_id), ["pokemon-kr-999"], "a record not on the list still fails");
assert.deepEqual(sorted.known, [{ kit_id: "pokemon-kr-116548761", urls: [PCO], reason: "hotlink" }]);
assert.deepEqual(sorted.recovered, ["pokemon-kr-133826295"], "has a picture again");
assert.deepEqual(sorted.gone, ["pokemon-kr-gone"], "fate-1 was only outside this run's franchise");

// ── the list itself: every entry says why, and none has a hand-picked cover. A record that gets a
// picture later is reported by the check ("take it off"), not failed here: the weekly bot commit
// that caches it must not break the unit tests.
const gaps = await loadImageGaps();
assert.ok(Object.keys(gaps).length > 0);
const manual = JSON.parse(readFileSync("data/manual-images.json", "utf8")).images;
for (const [kitId, reason] of Object.entries(gaps)) {
  assert.ok(reason.length > 40, `${kitId}: the reason is written out, not a bare key`);
  assert.ok(!manual[kitId], `${kitId} has a hand-picked cover, it is no gap`);
}
assert.equal(await loadImageGaps("data/no-such-file.json").then((value) => Object.keys(value).length), 0);

// ── hand-picked covers that point at our own copies exist ──
for (const [kitId, entry] of Object.entries(manual)) {
  if (entry.url.startsWith("./")) assert.ok(existsSync(path.resolve("app", entry.url.slice(2))), `${kitId}: ${entry.url}`);
}

console.log("image health tests passed");
