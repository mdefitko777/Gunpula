import assert from "node:assert/strict";
import { formatKrw, marketSearchLinksForKit, marketSources } from "../app/market-data.js";
import { pbandaiFranchiseForItem, pbandaiFranchises, pbandaiItems, safePBandaiImageUrl } from "../app/pbandai-store.js";

const pbandai = {
  items: [
    { url: "https://p-bandai.jp/a", category: "gunpla", fetch_status: "blocked", updated_at: "2026-01-01", image: "x" },
    { url: "https://p-bandai.jp/b", franchise: "pokemon", fetch_status: "ok", updated_at: "2026-02-01", images: ["https://img.test/b.jpg"] },
    { category: "gunpla" },
  ],
};

assert.equal(pbandaiItems(pbandai)[0].franchise, "pokemon");
assert.equal(pbandaiFranchiseForItem(pbandai.items[0]), "gundam");
assert.deepEqual(pbandaiFranchises(pbandai, ["gundam", "pokemon"]), ["pokemon", "gundam"]);
assert.equal(safePBandaiImageUrl(pbandai.items[1]), "https://img.test/b.jpg");

const sources = marketSources({
  sources: [
    { id: "taobao", priority: 1 },
    { id: "joongna", priority: 3, search_url_template: "https://j.example?q={query}" },
    { id: "naver_shop", priority: 2, search_url_template: "https://n.example?q={query}" },
  ],
});

assert.deepEqual(sources.map((source) => source.id), ["naver_shop", "joongna"]);
assert.equal(formatKrw(12000), "₩12,000");
assert.deepEqual(
  marketSearchLinksForKit(sources, "MG Freedom").map((item) => item.url),
  ["https://n.example?q=MG%20Freedom", "https://j.example?q=MG%20Freedom"],
);

console.log("pbandai-market tests OK");
