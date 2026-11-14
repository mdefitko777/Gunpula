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
| search.nintendo.jp（日本任天堂软件列表、发售日程、amiibo 阵容背后的 JSON） | robots.txt 是 `User-Agent: * Disallow: /`（2026-11-14） | 不读；任天堂频道改用韩国官方的 store.nintendo.co.kr 和 nintendo.com/kr | 日本的 amiibo、日本独有的软件和发售日 |
| store-jp.nintendo.com（My Nintendo Store 日本） | robots 允许 /list/，但每个商品页都跳到 Queue-it 排队页（store-jp-wr.nintendo.com，要跑 JS 拿令牌），属于 bot check | 不读 | 日本任天堂商店的周边（约 800 件）和 amiibo（约 140 件） |
| www.nintendo.com/kr/amiibo/lineup 的「더보기」 | 页面只内嵌最新 20 个 amiibo，其余要客户端 JS 调 Contentful API | 只读内嵌的 20 个，读过的记录保留；不跑网页 JS、不直接调 API | 2024-02 以前的韩国 amiibo |

## 韩国来源（2026-11-14 起）

项目原则仍是日本官方来源优先；下面这些是韩国官方或官方授权方，补韩国发售、韩文名和韩元价格，以及日本来源拿不到的任天堂频道。规则都在 `scripts/lib/` 对应文件里，抓取用 `scripts/lib/polite-fetch.mjs`（bot UA、先读 robots.txt、同站 ≥1.1 秒一次、403/429/503/bot check/跳到别的站就停）。

| 来源 | 脚本 | 拿什么 | 注意点 |
|---|---|---|---|
| 닌텐도 스토어 store.nintendo.co.kr | `import_nintendo_korea.mjs`（`nintendo_store_kr`） | 任天堂频道：游戏（实体＋下载合为一条）、主机与配件、amiibo 卡、周边；发售日、厂商、图片来自商品页 | robots.txt 为空（全允许）。只收任天堂发行的游戏；DLC、升级通行证、Online 会员、点卡、体验版、散装零件、线材、存储卡不收。商品页只读新商品和未发售的（每周再读一次），记在 `data/nintendo/store-details.json` |
| 한국닌텐도 www.nintendo.com/kr | 同上（`nintendo_kr`）、`fetch_bandai_announcements.mjs`（`nintendo_kr_news`） | 发售日程（只取「한국닌텐도」发行的）、最新 20 个 amiibo、新闻里的商品消息 | robots.txt 对 `*` 允许，但点名拒绝 ClaudeBot、GPTBot 等 AI 爬虫；本 bot 属于 `*`。数据从服务器渲染的 flight 数据里读，不跑网页 JS |
| 반다이남코코리아몰 www.bnkrmall.co.kr | `import_bnkr_pokemon.mjs`（`bnkrmall_kr`） | 万代的宝可梦韩国发售：포켓프라、프라코로、나노블럭、스케일 월드、깜짝에그；韩元价、JAN（商品页「모델명」） | 条款页在 robots 禁止的 /cscenter/ 下，店主决定按允许处理；读的路径（/goods/）robots 允许。没有发售日，用图片上传月份当上架月 |
| 아카데미과학 academy.co.kr | `import_academy_pokemon.mjs`（`academy_kr`） | 多美的宝可梦韩国发售：몬콜레（含旧 EMC/EHP/ESP）、포켓피스、말랑콕콕、포코피아 | 只读搜索列表（商品页没有 JAN、发售日）；发售年取自 S{YY} 商品编号。不是 academyhobby.co.kr（零售店） |

合并规则：韩国商品是目录里已有的同一商品时不新建记录，只给原记录加来源、韩元价、JAN（和原记录自己的 JAN 相同时写 `jan`，不同的是韩国版的，写 `jan_kr`，不覆盖 `jan`）—— JAN 相同（`jan`、id 里的 JAN 或 `jan_kr`）；或 Pokepla 线和编号相同（QUICK!! 29 = 퀵!! 29，No.62 = 62 셀렉트 시리즈）；或 MonColle 的宝可梦韩文名相同且两边写了的尺寸一致（아카데미 仍用旧 EX 名称卖 MS/ML：「EMC시리즈」= MS，「EHP시리즈」= ML，「ESP시리즈」只配没写尺寸的记录，如 Mega）；都只在恰好一条候选时才合并（「피카츄」这种多条候选的不合并）。反过来，同一条记录被店里几件商品匹配时，只让唯一一件用现行名称（몬콜레 MS …）的合并，用旧名称的留作自己的记录；没有唯一的就都不合并（「EMC시리즈 피카츄」有 S81329、S81336 两件）。韩国店自建的记录（`bnkr-<gno>`、`academy-<product_no>`）以后匹配上目录记录时，旧 id 写进 `data/kit-aliases.json`。

宝可梦与任天堂的重叠：游戏、主机、配件（包括宝可梦作品，如 Pokopia、LEGENDS Z-A）归 `nintendo` 频道（系列 `nintendo_pokemon`，标签 `pokemon`）；포켓몬스토어 的「닌텐도 게임」分类照旧不导入，所以不会重复。宝可梦角色周边留在 `pokemon`。
