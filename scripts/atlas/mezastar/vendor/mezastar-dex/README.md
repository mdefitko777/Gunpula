# Vendored data: khanh-aera/mezastar-dex

Upstream: https://github.com/khanh-aera/mezastar-dex (MIT, see `LICENSE` in this folder — keep it).
Snapshot: commit `c325e73ca6dfade01f48a6b3a10c2424c6134658` (2026-10-18), files copied byte-for-byte from `data/`.

| File | Used for |
|---|---|
| `stats_allsets.json` | International tag stats (HP/Atk/Def/SpA/SpD/Spe), PokéEnergy, move(s), gimmick, community grade. Also the community codes for legacy (`L (1-3-1)`) and promo (`P (G-001)`) tags. Galaxy V3 is not covered. |
| `pool.json` | Curated types for 147 international tags (the sheet's `types` column is unreliable, see `SOURCES.md`). |
| `bulba_jp_reference.json` | JP tag stats/move/energy harvested by mezastar-dex from Bulbapedia per-tag pages (CC BY-NC-SA 2.5 — attribute Bulbapedia). |
| `SOURCES.md` | Upstream provenance notes (community Google Sheet by Kaizen Hayashi, Bulbapedia, official sites). |

Attribution shown in the app: "Stats: mezastar-dex (MIT) / community sheet by Kaizen Hayashi; JP stats via Bulbapedia (CC BY-NC-SA 2.5)".
To refresh, copy the same files from a newer upstream commit and update the hash above.
