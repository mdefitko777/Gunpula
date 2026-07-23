# Ionic Vue 重构计划

分支 `rewrite-ionic`。目标：UI 全量换成 Ionic + Vue，功能保留，做完一次性合并上线。
线上 `app/`（纯 JS 版）在合并前保持不动、继续服务用户。

## 架构原则：保内核、换外壳

框架无关的逻辑/数据层**原样复用**（从 `app/` 搬到 `ionic/src/services` 或直接 import）：

- `i18n.js`（4 语言翻译表）
- `collection-store.js`（收藏/已购数据模型）
- `catalog-display.js`（grade 短标签、展示辅助）
- `catalog-loader.js` / `search-index-store.js`（目录加载、搜索索引）
- `world-themes.js`（五世界配置）
- `auth.js` + `sync-config.js`（Supabase 邮箱 OTP 登录）
- `market-data.js` / `update-feed.js` / `pbandai-store.js` / `view-state.js` / `storage.js` / `image-utils.js`

**只重写渲染层**：`main.js`（万行）、`dialogs.js`、`dom-utils.js` → Vue 组件。

## 技术栈

- Ionic Vue 8 + Vue 3 + vue-router + Vite 6
- 构建 `base: /Gunpula/app/`；产物合并时落进 `app/`，GitHub Pages 直接发布
- Capacitor `server.url` 不变（仍指向线上 Pages，APK 自动更新）
- 数据仍读同一份 `data/`（dev 期从线上 Pages 拉，合并后读相邻 `../data/`）

## 必须保留的功能（逐项验收，一个都不能丢）

- [x] 底部五导航：首页 / 目录 / 最近 / 收藏 / 图鉴
- [ ] 五世界切换（高达 / AC / 宝可梦 / Fate / BBX）= 全局过滤
- [ ] **长按圆盘菜单**（radial）+ **滑动切换**（pager）——招牌手势，用 Ionic `createGesture` 重建
- [ ] 目录：搜索 + 多维筛选（系列/产品线/类型/年份/限定/价格区间）
- [ ] 商品详情页
- [ ] 最近页：最近添加 / 本月发售 / 全部（含切月）
- [ ] 收藏：想要 / 已购买，全量分组浏览
- [ ] 图鉴：按世界（高达时间线合并、宝可梦世代、BBX 陀螺/部品、Atlas 分组、点亮已拥有）
- [ ] 我的：头像/用户名/喜好系列、图鉴计数、最近查看入口
- [ ] 账号同步：邮箱 OTP 登录、共享空间/邀请码、好友主页看对方收藏
- [ ] 设置、主题（浅/深色 + 世界配色）
- [ ] PWA（service worker、离线、安装）
- [ ] i18n 四语言

## 阶段（内部构建顺序，全部完成再合并）

0. **地基**（✅ 已完成）：Vite+Ionic Vue 骨架、5 tab 壳、真实数据打通、构建通过
1. 逻辑层移植 + 全局状态（Pinia 或轻量 store）：目录加载、世界过滤、收藏、i18n、主题
2. 首页 + 世界切换 + 主题贯彻
3. 目录：列表 + 搜索 + 筛选
4. 商品详情
5. 最近页三视图
6. 收藏页（想要/已购）
7. 图鉴（各世界 + Atlas 分组 + 点亮）
8. 我的 + 账号同步 + 好友
9. **手势**：长按圆盘 + 滑动切换（用 Ionic 手势系统重建）
10. 设置 + PWA + 深色/世界主题打磨
11. 全量回归验收（对照上面清单）→ 构建 → 合并进 `app/` → 上线

## 部署（合并时）

- `ionic/` 构建 → 产物覆盖 `app/`（或改 Pages 指向 `ionic/dist`）
- 版本号 bump、sw 缓存版本 bump
- Capacitor 无需改动
