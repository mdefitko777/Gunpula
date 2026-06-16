# 数据模型

这个项目先把数据分成两层：

1. `data/grades.json`：等级和模型线字典，例如 HG、MG、RG、PG、SD、FM。
2. `data/kits.json`：具体套件记录，每条记录通过 `grade_code` 关联到等级字典。

## Kit 字段

| 字段 | 说明 |
|---|---|
| `kit_id` | 全局唯一 ID，使用小写英文和连字符。 |
| `grade_code` | 等级代码，必须存在于 `data/grades.json`。 |
| `subline` | 更细分类，例如 HGUC、HGCE、MG Ver.Ka、PG Unleashed。 |
| `number` | 官方编号，没有就填 `null`。 |
| `scale` | 比例，例如 `1/144`、`1/100`、`1/60`、`non-scale`。 |
| `names` | `ja`、`en`、`zh` 三语名称，未知可填 `null`，但至少一个要有值。 |
| `universe` | 世界观，例如 UC、CE、AD、Ad Stella、Build。 |
| `work_title` | 出处作品或企划名称。 |
| `release_date` | 发售时间，支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 或 `null`。 |
| `price_jpy` | 日元定价，未知填 `null`。 |
| `is_limited` | 是否限定。 |
| `data_status` | `seed`、`needs_review`、`verified`、`retired`。 |
| `source_urls` | 来源链接数组。 |
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
- `kit_id` 是否重复。
- 日期、价格、布尔值等字段格式。
- 比例是否落在该等级的常见比例内。
