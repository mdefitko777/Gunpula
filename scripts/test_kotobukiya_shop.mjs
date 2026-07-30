import assert from "node:assert/strict";
import { parseKotobukiyaShopDetail, parseKotobukiyaShopListings } from "./lib/kotobukiya-shop.mjs";

const [listing] = parseKotobukiyaShopListings(`
  <li class="tile_item normal">
    <a href="/shop/g/g4934054083237/" title="クレスト CR-C98E2 強襲型Ver.">
      <img class="lazy" data-original="/img/goods/S/VI098_CREST_eye.jpg">
      <div class="name">クレスト CR-C98E2 強襲型Ver.</div>
    </a>
  </li>`);
assert.equal(listing.product_id, "4934054083237");
assert.equal(listing.image_url, "https://shop.kotobukiya.co.jp/img/goods/S/VI098_CREST_eye.jpg");

const detail = parseKotobukiyaShopDetail(`
  <h1 class="goods_name_">クレスト CR-C98E2 強襲型Ver.</h1>
  <dl class="goods_category_"><dt>カテゴリ：</dt><dd>プラモデル本体</dd></dl>
  <dl class="goods_release_"><dt>発売月：</dt><dd>2026年10月</dd></dl>
  <span class="price_num_">7,920円</span>
  <dl><dt>作品名</dt><dd>ARMORED CORE</dd><dt>仕様</dt><dd>組み立て式プラモデル</dd><dt>スケール</dt><dd>1/72</dd></dl>
  <img src="/img/goods/L/VI098_CREST_01.jpg">
`, listing.detail_url);
assert.equal(detail.is_plastic_model, true);
assert.equal(detail.release_date, "2026-10");
assert.equal(detail.price_jpy, 7920);
assert.equal(detail.scale, "1/72");
assert.equal(detail.gallery[0], "https://shop.kotobukiya.co.jp/img/goods/L/VI098_CREST_01.jpg");

console.log("kotobukiya-shop tests OK");
