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
