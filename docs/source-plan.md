# 数据来源计划

目标不是一次手工填完，也不是押宝单一网站。Bandai Hobby 信息不完整，所以项目采用多来源交叉验证：官方来源做锚点，目录/评测/店铺来源补覆盖，Wiki 类来源只辅助背景。

## 推荐顺序

1. **等级字典**：已经在 `data/grades.json` 里完成第一版。
2. **核心普通贩售套件**：优先 HG、MG、RG、PG、EG、FM、MGSD。
3. **限定和变体**：P-Bandai、会场限定、透明版、电镀版、特别涂装。
4. **历史线和特殊线**：FG、AG、SG、EX、U.C. Hard Graph、HY2M 等。

## 来源分工

| 来源 | 适合拿什么 | 注意点 |
|---|---|---|
| Bandai Hobby / Bandai Spirits | 官方名称、发售日期、价格、官方图片 | 信息不全，旧模、限定、历史线和下架页面可能缺失；只作为官方锚点。 |
| The Gundam Base | 限定、活动、官方零售展示 | 不适合完整普通贩售历史。 |
| Dalong.net | 按等级浏览、盒图、实物照片、编号 | 很适合补齐 HG/MG/RG，但字段需要清洗。 |
| Hobby Search / HLJ / AmiAmi | 商品名、价格、发售月份、商品图 | 店铺状态会变化，不能只依赖库存页面。 |
| Wiki 类资料 | 历史和等级背景 | 适合辅助，不适合作为最终价格/发售日唯一来源。 |

## 建议的验证规则

| 数据字段 | 首选来源 | 补充来源 |
|---|---|---|
| 官方商品名 | Bandai Hobby / The Gundam Base | Hobby Search、HLJ |
| 等级 / 比例 / 子系列 | Dalong、Bandai Hobby | Wiki、店铺标题 |
| 发售日期 / 发售月份 | Bandai Hobby、Hobby Search、HLJ | Wiki |
| 日元定价 | Bandai Hobby、Hobby Search | HLJ |
| 盒图 / 板件 / 实物图 | Dalong | 店铺图、官方图 |
| 世界观 / 作品归属 | Gundam Wiki、官方商品标题 | Wikipedia |

## 导入原则

- 自动导入的新记录先标 `needs_review`。
- 人工核对过来源后再改成 `verified`。
- `verified` 不要求所有字段都来自 Bandai，但必须能解释每个关键字段由哪个来源支撑。
- 只要出现同名不同版本，必须拆成不同 `kit_id`。
- 限定版不要覆盖普通版，用 `is_limited: true` 和不同 `kit_id`。

## 来源覆盖检查

运行：

```bash
npm run sources
```

它会列出当前记录使用了哪些来源，以及哪些记录还缺官方来源或实物/目录来源。
