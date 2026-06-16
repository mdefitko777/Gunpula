# Gunpla 等级与模型线第一版

这个表先解决“有哪些等级/模型线”的问题，后面统计具体套件时，每条模型记录都可以用 `grade_code` 对应到这里。

## 范围

- 包含：核心等级、SD 系列、1/100 分支线、历史线和特殊塑料拼装线。
- 暂不包含：成品玩具、金属成品、食玩、第三方模型、树脂改件/车库件。
- HGUC、HGCE、HGAC 这类先作为 HG 的别名/子系列处理，避免第一版粒度过细。

## 核心等级

| Code | 中文 | English | 常见比例 | 状态 | 备注 |
|---|---|---|---|---|---|
| EG | 入门级 | Entry Grade | 1/144 | active | 现代入门线，强调少工具、少贴纸、容易组装。 |
| HG | 高等级 / HG | High Grade | 1/144, 1/100, 1/60 | active | 最主流的入门到中级线，HGUC/HGCE/HGAC 等归为 HG 子系列。 |
| RG | 真实级 | Real Grade | 1/144 | active | 1/144 高密度细节线，强调真实机械感、分色、贴纸和内构。 |
| MG | 大师级 | Master Grade | 1/100 | active | 1/100 主力高细节系列，常见完整或接近完整内构。 |
| MGEX | 大师级极致版 | Master Grade Extreme | 1/100 | active_limited_release | MG 的高端子线。 |
| PG | 完美级 | Perfect Grade | 1/60 | active_limited_release | 大型高价旗舰线。 |
| PGU | 完美级解放版 | Perfect Grade Unleashed | 1/60 | active_limited_release | PG 的高端进化子线。 |

## 1/100 分支线

| Code | 中文 | English | 常见比例 | 状态 | 备注 |
|---|---|---|---|---|---|
| RE100 | RE/100 | Reborn-One Hundred | 1/100 | inactive_or_rare | 1/100 无完整 MG 内构的系列，适合补完较冷门机体。 |
| FM | 全机械骨架 / FM | Full Mechanics | 1/100 | active | 外观细节和机关较强，通常没有 MG 级完整内构。 |
| HIRM | 高解析度模型 | Hi-Resolution Model | 1/100 | inactive_or_rare | 高价 1/100 线，常见预组装或高完成度骨架与外甲组合。 |

## SD / Q版

| Code | 中文 | English | 常见比例 | 状态 | 备注 |
|---|---|---|---|---|---|
| SD | SD / Q版 | Super Deformed | non-scale | active | Q 版模型总称，包含多个长期子系列。 |
| SDEX | SD EX-Standard | SD Gundam EX-Standard | non-scale | active_or_recent | 国际向低价标准线。 |
| SDCS | SDCS / Cross Silhouette | SD Gundam Cross Silhouette | non-scale | active_or_recent | 可通过骨架切换比例风格。 |
| SDW | SD 三国创杰传 / 世界英雄 | SD Gundam World | non-scale | active_or_recent | 三国、英雄题材再设计。 |
| MGSD | 大师级 SD | Master Grade SD | non-scale | active | SD 造型结合接近 MG 的零件密度、分色和可动表现。 |

## 历史线与特殊线

| Code | 中文 | English | 常见比例 | 状态 | 备注 |
|---|---|---|---|---|---|
| NG | 无等级 / 旧模 / TV | No Grade | 1/144, 1/100, 1/60, various | historical | 固定分级前或未进入正式分级体系的套件。 |
| BMC | 最佳机甲收藏 / 初代旧模复刻线 | Best Mecha Collection | 1/144, various | historical_with_revival | 早期无等级套件的重要系列。 |
| FG | 初级 / 首级 | First Grade | 1/144 | inactive | 低价简化线，分色和可动较少。 |
| AG | 进阶级 | Advanced Grade | 1/144 | inactive | 《Gundam AGE》时期的低价线。 |
| SG | 速组级 | Speed Grade | 1/200 | inactive | 小比例预涂装线。 |
| MEGA | Mega Size 大比例模型 | Mega Size Model | 1/48 | inactive_or_rare | 超大比例、结构相对简化。 |
| EX | EX 模型 | EX Model | 1/144, 1/1700, various | inactive | 偏战舰、载具、支援机等题材。 |
| UCHG | U.C.硬派写实 | U.C. Hard Graph | 1/35 | inactive | 偏军事模型风格。 |
| HAROPLA | 哈罗模型 | HaroPla | non-scale | active_or_recent | 哈罗主题拼装线。 |
| IROPLA | Iropla 多色成型早期线 | Iropla | 1/250 | inactive | 早期多色成型尝试。 |
| LM | Limited Model | Limited Model | 1/144, various | inactive | 90 年代低价简化模型线。 |
| HY2M | HY2M / Hyper Hybrid Model | Hyper Hybrid Model | 1/60, 1/100, 1/24, various | inactive | 大型或灯效等特殊卖点的历史线。 |

## 后续建模建议

具体模型数据建议使用这些字段：

| 字段 | 说明 |
|---|---|
| `kit_id` | 自定义唯一 ID |
| `name_ja` / `name_en` / `name_zh` | 多语言名称 |
| `grade_code` | 对应 `data/grades.json` 的 `code` |
| `subline` | HGUC、HGCE、Ver.Ka、P-Bandai 等更细分类 |
| `scale` | 1/144、1/100、non-scale 等 |
| `universe` | UC、SEED、00、WFM、IBO 等 |
| `release_date` | 发售日期 |
| `price_jpy` | 日元定价 |
| `is_limited` | 是否限定 |
| `source_url` | 来源链接 |
