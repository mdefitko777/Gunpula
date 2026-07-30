# Atlas CMS

Atlas CMS 是 Gunpula 的独立桌面内容管理后台：

- 正式地址：`https://mdefitko777.github.io/Gunpula/admin/`
- 本地地址：`http://localhost:4173/admin/`

它不复制 5,000 多条基础目录。基础数据仍由 GitHub Actions 抓取并保存在 `data/kits.json`，CMS 只保存人工审核产生的差异。这样每日抓取可以继续更新，人工修正也不会在下一次抓取时丢失。

## 第一次安装

1. 先用管理员邮箱在 App 或 Supabase Authentication 中完成一次登录，确保 `auth.users` 已有该用户。
2. 在 Supabase SQL Editor 完整执行 `docs/supabase-cms.sql`。
3. SQL 默认启用 `mdefitko@gmail.com`。如需更换管理员，修改脚本中的邮箱后重新执行管理员插入语句。
4. 打开正式 CMS，用邮箱验证码登录。

如果 SQL 在管理员用户创建前执行，最后的管理员插入不会写入任何记录。用户完成首次登录后，再执行一次那段 `insert into public.gunpula_cms_admins ... select from auth.users` 即可。

已经安装过旧版 CMS 的项目，只需再执行一次 `docs/supabase-cms-release-note-upgrade.sql`，即可在“发布版本”中修正版本说明。

## 数据分层

CMS 使用三层数据：

1. **基础层**：`data/kits.json`、`data/atlas-groups.json` 等仓库 JSON，由抓取任务生成。
2. **草稿层**：管理员的商品、分类、图片、合并和审核操作，只有管理员能看见。
3. **发布层**：管理员确认发布后的不可变 revision，正式 App 只读取最新发布层。

“预览 App”会把当前草稿写入同域的本地预览空间，并以 `?cms-preview=1` 打开 App。预览不会影响其他用户。

## 常用流程

### 修改商品

1. 打开“商品目录”，搜索商品。
2. 点击整行打开右侧编辑器。
3. 修改四语名称、主题、系列、产品线、发售、图片或来源。
4. 点击“保存草稿”。
5. 点击顶部“预览 App”检查结果。
6. 确认后点击“发布”并填写版本说明。

### 批量移动

分类体系中点开任意分类，可以先检查里面的商品，再跳到已按该分类筛选的商品目录。勾选商品后选择字段和目标值。一次批量操作共享一个 `batch_id`，因此点击一次撤销会恢复整批，不会只恢复最后一条。

### 合并重复商品

在“重复处理”中点击任意一侧可以查看完整名称、展示图、来源与分类，再选择保留左侧或右侧。CMS 不会删除旧 ID，而是建立旧 ID 到保留 ID 的映射。App 读取旧收藏记录时会自动解析到保留商品。

### 处理直播官宣

“官方预告”每天读取 BANDAI Hobby Site 新闻和官方 YouTube Feed。自动发现只建立候选，不填写不存在的价格或发售日。

1. 点开候选，检查直播封面、官方链接和时间点。
2. 补充四语暂定名、系列与产品线；误报可以标记为“已排除”。
3. 正式商品已经在目录中时填写它的 ID 并关联。
4. 正式商品尚未入库时填写新的稳定 ID，点击“关联 / 创建正式商品”。系统会同时创建待核对商品草稿并保留官宣历史。
5. 预览并发布后，App 的“最近 → 官方预告”会读取同一份审核结果。

### 恢复已发布修改

“变更记录”中的已发布操作可以点击“恢复修改前”。系统会创建一条新的恢复草稿，不会篡改旧 revision；仍需预览并再次发布。

## 图片和抓取

商品编辑器可以直接替换封面与展示图 URL。“加入缓存队列”会把商品、来源 URL、主题和申请时间记录到 CMS 发布数据中，供图片维护流程处理。

“抓取中心”读取 `data/source-health.json` 和 PB 缓存报告。CMS 前端不会直接抓取 Premium Bandai，也不会绕过区域限制；每日抓取仍由 GitHub Actions 和仓库脚本执行。

## 权限

- CMS 表全部启用 RLS，并撤销 `anon` / `authenticated` 的直接表权限。
- 写入、撤销、历史和发布只能通过 `security definer` RPC。
- 每个写 RPC 都会调用 `gunpula_cms_assert_admin()`。
- 普通 App 只能调用无参数的只读发布 RPC，无法读取草稿、管理员名单或完整历史。
- 不要把 Supabase service role key 放进前端、仓库或 GitHub Pages。

## 本地验证

```powershell
npm.cmd run app
```

打开 `http://localhost:4173/admin/`。本地模式使用浏览器中的隔离 CMS 数据，不会写入 Supabase。然后运行：

```powershell
node --experimental-vm-modules scripts/check_app_syntax.mjs
npm.cmd run test:unit
npm.cmd run validate
```
