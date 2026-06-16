# 数据模型

这个项目先把数据分成三层：

1. `data/grades.json`：等级和模型线字典，例如 HG、MG、RG、PG、SD、FM。
2. `data/sources.json`：来源登记表，用来说明每个来源擅长和不擅长什么。
3. `data/kits.json`：具体套件记录，每条记录通过 `grade_code` 关联到等级字典，并通过 `source_refs` 关联到来源登记表。

## Kit 字段

| 字段 | 说明 |
|---|---|
| `kit_id` | 全局唯一 ID，使用小写英文和连字符。 |
| `grade_code` | 等级代码，必须存在于 `data/grades.json`。 |
| `subline` | 更细分类，例如 HGUC、HGCE、MG Ver.Ka、PG Unleashed。 |
| `number` | 官方编号，没有就填 `null`。 |
| `scale` | 比例，例如 `1/144`、`1/100`、`1/60`、`non-scale`。 |
| `names` | `ja`、`en`、`zh` 三语名称，未知可填 `null`，但至少一个要有值。 |
| `images` | 图片字段，当前先使用 `box_art_url` 和 `box_art_source_id`。 |
| `gallery_image_urls` | 展示图 URL 数组，第一张通常与盒图相同，详情页使用。 |
| `universe` | 世界观，例如 UC、CE、AD、Ad Stella、Build。 |
| `work_title` | 出处作品或企划名称，例如 `Mobile Suit Gundam SEED Destiny`、`Mobile Suit Gundam 00`。 |
| `release_date` | 发售时间，支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 或 `null`。 |
| `price_jpy` | 日元定价，未知填 `null`。 |
| `is_limited` | 是否限定。 |
| `data_status` | `seed`、`needs_review`、`verified`、`retired`。 |
| `source_urls` | 简单来源链接数组，保留给快速浏览和兼容旧数据。 |
| `source_refs` | 结构化来源引用，记录来源 ID、URL、支撑字段和可信度。 |
| `tags` | 搜索和筛选用标签。 |
| `notes` | 备注。 |

## 数据状态

| 状态 | 含义 |
|---|---|
| `seed` | 种子记录，只用于跑通结构，不视作完整数据。 |
| `needs_review` | 已导入但还需要人工核对。 |
| `verified` | 已按可信来源核对。 |
| `retired` | 保留历史记录，但不参与常规展示。 |

## 校验

运行：

```bash
npm run validate
```

校验会检查：

- `grade_code` 是否能匹配等级表。
- `source_refs[].source_id` 是否能匹配 `data/sources.json`。
- `kit_id` 是否重复。
- 日期、价格、布尔值等字段格式。
- 比例是否落在该等级的常见比例内。

## 来源引用

`source_refs` 是后续自动导入的关键字段。一个套件可以有多个来源，每个来源只负责它擅长的字段。

```json
{
  "source_id": "hobby_search_jp",
  "url": "https://www.1999.co.jp/gundam/",
  "fields": ["box_art", "subline", "release_date", "price_jpy"],
  "confidence": "medium"
}
```

记录升级到 `verified` 前，必须有日本官方或日本店铺来源支撑；Dalong、Wiki、海外整理站只作为人工参考，不写入主数据来源。

`work_title` 目前由官方商品名规则推断，适合做筛选和初步整理；仍需人工核对后再把记录升级为 `verified`。
