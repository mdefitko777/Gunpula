# 好友系统 v3

把「一个共享空间 + 邀请码」换成正经的好友系统：**固定账号ID → 搜索 → 申请 → 对方同意**。

## 为什么换

旧的邀请码模型有五个硬伤：

| 问题 | 说明 |
|---|---|
| 一人只能待一个空间 | 数据库有唯一索引，想加别的朋友必须先退出 |
| 邀请码不能换、不能作废 | 流出去就再也关不上门 |
| 没有踢人功能 | 进来的人赶不走 |
| 所有人的数据挤在一个 payload | 任何成员保存都覆写整块，能冲掉别人的数据 |
| 有码就能进 | 没有「申请—同意」，谈不上正式 |

v3 全部解决：**各自的数据各自拥有，好友只能读不能写；随时可以解除；能加多个好友。**

## 隐私

`gunpula_v3_get_friend_collection` **只返回收藏**。首页封面照片存在 `payload.appearance` 里，
**永远不会给好友**——哪怕是已经同意的好友也看不到。

搜索 (`search_user`) 只返回账号ID、昵称、头像，**不返回邮箱**，也不返回任何收藏内容。

## 你要做的：跑一次 SQL

1. 打开 Supabase → 你的项目 → **SQL Editor**
2. 把 `docs/supabase-setup-v3.sql` 全文粘进去 → **Run**
3. 看到 Success 就好了

安全：这个脚本**不动 v1/v2 的任何表**，旧数据原样保留当备份。

## 数据怎么迁过来

app 里点一次「从旧空间导入」，会调 `gunpula_v3_migrate_from_v2()`：
把你在旧共享空间里**属于你自己的那份**收藏复制到你的新账号下。

- 只取你自己的桶，不会把别人的收藏搬到你名下
- 如果你的 v3 收藏已经有数据了，它会直接跳过，**不会覆盖**
- 旧表不删，随时能回头看

## 表结构

- `gunpula_v3_users` — 每人一行：`handle`(固定账号ID) + `payload`(自己的收藏) + 头像/昵称
- `gunpula_v3_friendships` — `requester_id / addressee_id / status(pending|accepted)`

## RPC

| 函数 | 作用 |
|---|---|
| `get_me()` | 我的资料 + 我的数据 + 好友列表 + 收到/发出的申请 |
| `claim_handle(handle)` | 设置/更改我的账号ID（3-20 位，a-z 0-9 _） |
| `update_profile(name, avatar, prefs)` | 改昵称/头像/喜好 |
| `save_state(payload, base_revision)` | 只能写我自己那行 |
| `search_user(handle)` | 按账号ID搜人，返回公开资料 + 我俩的关系 |
| `request_friend(handle)` | 发好友申请（对方若已申请过我，则直接成为好友） |
| `respond_friend(handle, accept)` | 同意 / 拒绝 |
| `remove_friend(handle)` | 解除好友，或撤回我发出的申请 |
| `get_friend_collection(handle)` | 看好友的收藏（**只读，且不含封面照片**） |
| `migrate_from_v2()` | 从旧共享空间导入我自己那份 |

所有表都 `revoke` 掉了直接访问，只能走这些 RPC；内部辅助函数不对外授权
（否则匿名调用者猜到 user id 就能拿到别人的账号名和头像）。
