# 数据来源计划

项目主数据只使用日本官方来源和日本店铺/目录来源。Dalong、Wiki、海外整理站可以作为人工参考，但不进入 `source_refs`，也不作为 `verified` 的依据。

## 推荐顺序

1. **日本官方/官方店铺**：BANDAI SPIRITS Product Search Japan、Premium Bandai Japan、The Gundam Base Japan。
2. **日本店铺目录**：Hobby Search Japan、AmiAmi Japan。
3. **核心普通贩售套件**：先做 RG，再扩展 HG / MG / PG / EG / FM / MGSD。
4. **限定和变体**：P-Bandai、Gundam Base 限定、会场限定、透明版、电镀版、特别涂装。

## 来源分工

| 来源 | 适合拿什么 | 注意点 |
|---|---|---|
| BANDAI SPIRITS Product Search Japan | 官方商品搜索、ガンプラ分类、发售时期、官方商品页入口 | 搜索页依赖 JavaScript，抓取时要优先找稳定的商品页。 |
| Premium Bandai Japan | P-Bandai 限定、价格、发售月、官方图 | 只覆盖限定/网店商品。 |
| The Gundam Base Japan | Gundam Base 限定、活动限定、价格、发售日、库存 | 不适合完整普通贩售历史。 |
| Hobby Search Japan | 日文商品名、发售月、价格、盒图、分类 | 店铺目录，不是官方来源。 |
| AmiAmi Japan | 日文商品名、发售月、价格、商品图、系列筛选 | 店铺目录，不是官方来源。 |

## 验证规则

| 数据字段 | 首选来源 | 补充来源 |
|---|---|---|
| 官方商品名 | BANDAI SPIRITS Product Search Japan / Premium Bandai Japan / The Gundam Base Japan | Hobby Search Japan、AmiAmi Japan |
| 等级 / 比例 / 子系列 | BANDAI SPIRITS Product Search Japan / 日本店铺标题 | Hobby Search Japan、AmiAmi Japan |
| 发售日期 / 发售月份 | Bandai 官方/官方店铺 | Hobby Search Japan、AmiAmi Japan |
| 日元定价 | Bandai 官方/官方店铺 | Hobby Search Japan、AmiAmi Japan |
| 盒图 | Bandai 官方/官方店铺 | Hobby Search Japan、AmiAmi Japan |
| 作品归属 | 官方商品标题 | 日本店铺标题 |

## 导入原则

- 自动导入的新记录先标 `needs_review`。
- `verified` 必须有日本来源支撑，不能只靠 Wiki、Dalong 或海外整理站。
- 普通版、限定版、透明版、电镀版、活动版都拆成不同 `kit_id`。
- 如果 Bandai 官方缺页，用两个日本店铺来源交叉确认后可标 `needs_review`，人工核对后再升 `verified`。

## 来源覆盖检查

运行：

```bash
npm run sources
```

它会列出当前记录使用了哪些来源，以及哪些记录还缺日本官方/日本目录来源。

## 拒绝本 bot 的站点 (Blocked hosts)

2026-11-14 整理。规则：被拒（403 / 429 / 503、bot check、JS challenge）就停，不换 UA、不加 Referer/cookie、不走代理或别的 IP、不跑网页 JS；每天都被拒的站点不再每天去问（停用或休息），改找同一数据的合法来源，找不到就写在这里。

| 站点 | 现象 | 现在怎么做 | 还缺什么 |
|---|---|---|---|
| bsp-prize.jp `/files/`（景品原图） | 对 bot 和 App 都回 403（Cloudflare，无 challenge 页），2026-11-07 起 CI 每次都失败 | まどか景品改用列表页 250px 缩略图（与 Fate、Pokémon 相同），不再读商品页、不再发布 `/files/` 地址（`scripts/lib/bsp-prize.mjs`）；已缓存的 3 张原图保留 | 景品的大图和多角度图 |
| www.1999.co.jp（ホビーサーチ） | 对 GitHub runner 的 IP 回 Cloudflare challenge（403），家用线路正常：是 IP 封锁 | Fate、まどか两个导入都不再请求；已有的 Fate 记录保留（离线整理）。BUSHIROAD THE BOX 改从 bushiroad-creative.com 官方目录读（`bushiroad_creative_fate_jp`） | 只有这家店有的厂商新品：CHILLfigg、AQ、Reincarnation 等；PalVerse（palverse-figure.com，有 FGO）和 PRISMA WING（Prime 1 Studio）还没接 |
| www.pokemoncenter-online.com | CI 上间歇 403（约一半的天） | 被拒不再重试，当天跳过，记录保留 | 当天的新毛绒和价格晚一天 |
| www.amazon.co.jp、web.joongna.com（行情） | CI 上每天 503 robot check / CloudFront 403，robots.txt 允许 | 连续两次被拒就休息 7 天再问一次（`data/market_auto_listings.json` 的 `retry_after`） | 这两家的行情 |
| tamashii-nation.tamashiiweb.com robots.txt | S3 对不存在的文件回 403 | 当作没有 robots.txt，日志不写成 403 | 无 |
| www.youtube.com 播放页 | 读几页后出现登录 bot check | 当次停止 YouTube；轻量刷新不读 YouTube | 部分直播时间晚一天 |
