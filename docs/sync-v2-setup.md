# 账号同步 v2 配置指南（邮箱验证码登录）

新版同步用"邮箱 + 验证码"登录替代旧的六框密钥。旧版同步继续可用，
迁移完成前两边互不影响。你需要做三步，全程约 10 分钟。

## 第一步：Supabase 后台（一次性）

1. 打开 [supabase.com](https://supabase.com) → 进入你现有的项目
   （就是旧版同步在用的那个）。
2. 左侧 **SQL Editor** → New query → 把 `docs/supabase-setup-v2.sql`
   的全部内容粘贴进去 → Run。看到 "Success" 即可（旧表不受影响）。
   以后如果 app 增加新的同步功能，也可以重新运行同一个 SQL 文件；
   `create or replace function` 会更新函数，不会清空你的收藏数据。
3. 左侧 **Authentication → Emails → Templates**：
   把 **Confirm sign up** 和 **Magic Link or OTP** 两个模板都改成验证码邮件。
   正文必须包含验证码变量 `{{ .Token }}`，不要只保留 `{{ .ConfirmationURL }}`。
   例如：

   ```html
   <h2>Gunpula 登录验证码</h2>
   <p>请输入这个 6 位验证码：</p>
   <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">{{ .Token }}</p>
   <p>如果不是你本人操作，可以忽略这封邮件。</p>
   ```

   新邮箱第一次登录时可能走 **Confirm sign up** 模板；老邮箱再次登录时通常走
   **Magic Link or OTP** 模板。只改其中一个，就会出现“有邮件但看不到验证码”。

> 免费版自带邮件服务有频率限制（每小时几封），两个人用完全够；
> 以后想要更稳可以在 Authentication → SMTP 里接自己的邮箱服务。

## 第二步：把后端地址写进 app（一次性）

打开 `app/sync-config.js`，填入两个值后提交推送：

- `url`：Supabase 项目的 Project URL（Settings → API → Project URL，
  形如 `https://xxxx.supabase.co`）
- `anonKey`：同一页面的 anon public key

anon key 本来就是公开密钥，提交到仓库是安全的——数据访问由
RLS 和 RPC 函数控制，不靠隐藏这个 key。

## 第三步：在 app 里登录 + 迁移（每人一次）

**你（数据的主人）：**

1. 设置 → 账号与同步 → 输入邮箱 → 发送验证码 → 输入邮箱里的 6 位码登录。
2. 点 **创建共享空间**。
3. 面板里会出现 **迁移旧版数据** 按钮（因为本机存有旧版配置）——
   点它，老空间的收藏/更正会整体导入新空间。确认列表数据无误。

**对方：**

1. 同样用自己的邮箱登录。
2. 把你面板里显示的 **邀请码** 发给 TA，TA 输入后点 **加入空间**。
   加入即采用空间内的共享数据。

**收尾（可选）：** 两人都迁移完、用了几天确认没问题后，
在"旧版密钥同步（高级）"里点 **断开云同步** 清掉旧密钥。
Supabase 里的旧表数据不会被删，留作备份。

## 之后的日常

- 换新手机/新设备：装好 app → 邮箱登录 → 数据自动回来。
- 谁改的收藏，同步状态里会显示对方的名字（来自邮箱前缀，
  也可以在旧版面板的"你的名字"里预先设置）。
- 登录状态长期有效，无需重复登录。
