# Gunpula / Collection Atlas

一个给两个人一起用的收藏图鉴 App。

它现在主要管理这些分类：

- 高达 / Gunpla / Robot 魂 / Metal Build / 食玩 / 扭蛋 / PB 限定
- Armored Core 拼装和周边
- 宝可梦拼装、玩偶、扭蛋、周边
- Fate / FGO 手办、黏土人、一番赏、扭蛋、周边
- Beyblade X，包括 BX / CX / UX / 限定和部件图鉴

网站地址：

[https://mdefitko777.github.io/Gunpula/app/](https://mdefitko777.github.io/Gunpula/app/)

Android APK：

[gunpula-debug.apk](https://github.com/mdefitko777/Gunpula/releases/download/android-latest/gunpula-debug.apk)

## 这是什么

这不是普通数据库表格，而是一个手机优先的收藏图鉴。

你可以：

- 按分类浏览商品
- 搜索中 / 韩 / 英 / 日名称
- 看商品图、发售日、定价和官方链接
- 标记“想要”和“已购买”
- 两个人共享同一个收藏空间
- 查看对方想要什么、买了什么
- 手动修正名称、系列、封面图
- 看最近更新
- 看 Premium Bandai JP 的缓存数据
- 安装成 Android App 使用

## 普通使用

### 网页版

直接打开：

[https://mdefitko777.github.io/Gunpula/app/](https://mdefitko777.github.io/Gunpula/app/)

如果手机上看不到新版，去设置里点“刷新缓存”，或者关闭 App 后重新打开。

### Android 版

下载：

[gunpula-debug.apk](https://github.com/mdefitko777/Gunpula/releases/download/android-latest/gunpula-debug.apk)

安装时需要允许“未知来源”。这是 debug 包，不是 Play Store 正式签名包。

App 内容更新一般不需要重新下载 APK，因为 App 会优先读取线上数据。只有底层壳版本变化时，才需要重新安装新版 APK。

## 同步和共享

同步使用 Supabase。

现在推荐使用邮箱验证码登录：

1. 在设置里登录邮箱
2. 创建共享空间
3. 把邀请码发给另一个人
4. 对方在设置里输入邀请码加入

加入后，两个人可以共享：

- 已购买
- 想要
- 数量
- 手动修正
- 首页封面
- 头像、名称、背景图

旧版密钥同步还保留在高级设置里，但新用户建议直接用邮箱登录。

Supabase 初始化 SQL：

- `docs/supabase-setup-v2.sql`

## 数据怎么更新

项目是静态网页。用户打开网页时，不会直接爬官方站。

数据更新靠 GitHub Actions：

### 官方目录更新

Workflow：

- `.github/workflows/refresh-catalog.yml`

它负责：

- 抓日本官方来源
- 合并手动数据
- 翻译和整理名称
- 生成最近更新
- 生成搜索数据
- 分片数据
- 校验数据
- 自动提交到 GitHub

### 市场价更新

Workflow：

- `.github/workflows/market-prices.yml`

市场价已经从官方目录更新里拆出去了。

原因很简单：市场价来源慢或者失败时，不能影响官方新品进库。

现在官方目录和市场价是两条独立任务：

- 官方目录失败，只影响目录
- 市场价失败，只影响市场价
- 市场价卡住，不会拖死每日新品更新

## Premium Bandai JP

前端不会直接访问 `p-bandai.jp`。

`p-bandai.jp` 对日本以外的 IP 是全站封锁：包括 `robots.txt` 和 `sitemap.xml` 在内的每一个路径，都会返回同一个约 2.2KB 的「アクセス制限」页。改请求头没用（`Accept-Language: ja-JP`、Googlebot UA 都试过），它按 IP 判断，所以直抓在 GitHub 官方 runner 上永远不可能成功。

因此 PB 日本站走两条互补的间接路径：

1. **反查**（`npm run import:pb`）——抓万代 SPIRITS 官方商品页（不锁区），从 HTML 里提取真实的 `p-bandai.jp/item/item-xxxx/` 链接。覆盖存量老品，但看不见没有万代商品页的 PB 独占新品。
2. **存档**（`npm run import:pb:wayback`）——archive.org 不在万代的封锁名单里，存有完整的日文商品页。补上反查的盲区，并拿到只有 PB 页面才有的价格、受注期间、发送月份和在售状态。

两者都挂在每日 `npm run import:data` 里，不需要日本 IP，也不需要 self-hosted runner。

输出缓存：

- `data/pbandai.json`
- `data/premium-bandai-jp-index.json`（反查的扫描记录）
- `data/premium-bandai-wayback-index.json`（存档抓取的增量记录）

手动补充：

- `data/pbandai_manual_products.json`

这些脚本不会做登录绕过、验证码绕过、代理轮换或反爬绕过。存档路径读的是 archive.org 的公开快照，不去碰被封锁的源站。

## 本地运行

需要 Node.js。

```bash
npm install
npm run app
```

打开：

[http://localhost:4173/app/](http://localhost:4173/app/)

Windows PowerShell 如果 `npm` 被策略拦截，就用：

```powershell
npm.cmd run app
```

## 常用命令

检查数据：

```bash
npm run validate
```

检查前端模块和核心逻辑：

```bash
node --experimental-vm-modules scripts/check_app_syntax.mjs
npm run test:unit
```

重新生成最近更新：

```bash
npm run updates
```

重新生成搜索和市场数据：

```bash
npm run market
```

导入官方数据：

```bash
npm run import:data
```

拆分前端加载数据：

```bash
npm run split
```

查重复候选：

```bash
npm run duplicates
```

高达系列审计：

```bash
npm run audit:gundam-series
```

检查图片：

```bash
npm run check:images
```

宝可梦图片修复：

```bash
npm run repair:pokemon-images
```

## Android 构建

GitHub Actions 会自动构建 debug APK，并上传到固定 release：

[android-latest](https://github.com/mdefitko777/Gunpula/releases/tag/android-latest)

本地构建需要 Android Studio / JDK / Android SDK：

```bash
npm run android:add
npm run android:sync
npm run android:build
```

`android:add` 只需要第一次执行。

## 主要目录

- `app/`：前端 App
- `data/`：商品、来源、搜索、PB、市场价等 JSON 数据
- `scripts/`：导入、校验、生成、缓存脚本
- `docs/`：Supabase 和数据说明
- `.github/workflows/`：自动更新、CI、APK 构建

## 现在的底层结构

前端是原生 JavaScript ES modules，没有 React/Vue。

主要模块：

- `app/main.js`：主界面和页面逻辑
- `app/catalog-loader.js`：数据加载，Android 壳内优先读取线上数据
- `app/view-state.js`：URL hash、筛选状态、返回键状态
- `app/search-index-store.js`：搜索索引注入
- `app/collection-store.js`：收藏数据、成员数据、冲突合并
- `app/storage.js`：localStorage 包装
- `app/dialogs.js`：dialog 打开/关闭保护
- `app/image-utils.js`：图片 fallback
- `app/dom-utils.js`：HTML 转义
- `app/auth.js`：Supabase 邮箱验证码登录
- `app/i18n.js`：中 / 韩 / 英 / 日 UI 文案

## 当前状态

当前数据大约 4,800 多条，覆盖高达、AC、宝可梦、Fate、BBX。

项目已经支持：

- 静态网页
- Android APK
- Supabase 双人同步
- 最近更新
- Premium Bandai 缓存
- Beyblade X 部件图鉴
- 多语言名称
- 本地图片缓存和图片健康检查

## 还有什么需要继续做

比较值得继续优化的是：

- 继续拆小 `app/main.js`
- 给图片缓存加容量清理
- 把全量图片检查改成默认轻量检查
- 压缩部分过大的本地图片
- 给 Supabase 同步增加更多单元测试
- 整理设置页，让普通设置和维护工具分得更清楚

## 一句话

这个项目的目标不是做一个“商品数据库后台”，而是做一个可以每天打开、好看、能同步、能查图、能记录想要和已购买的收藏图鉴 App。
