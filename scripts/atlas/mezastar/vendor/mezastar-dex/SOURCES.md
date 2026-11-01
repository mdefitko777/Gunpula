# Mezastar Dex Data Sources

Confidence-ranked registry of every tag-data source, what it provides, and validation status.
Checked 2026-10-02.

## 1. Community Google Sheet (Kaizen Hayashi)
- `stats_allsets.json` (469 tags), `pool.json` (147), `bosses.json`, `typechart.json`
- Primary source for stats, PE, moves, gimmicks, boss lineups.
- CAVEAT FOUND: its `types` column is unreliable (duplicated move-type values like `['Rock','Rock']`). The site correctly uses `pool.json` types instead. Do NOT trust sheet `types`.

## 2. Bulbapedia (JP per-tag pages)
- `docs/data/bulba_jp_reference.json` - 1,037 tags with full stat blocks (HP/Atk/Def/SpA/SpD/Spe), move, move type, energy, grade, harvested from the MediaWiki API (`MezastarExpansionList` rows across Super Tag 1-5, Gorgeous Star 1-5, Double Chain 1-5 set pages; per-tag pages `{{MezastarData}}`).
- JP release data. Cross-check results vs our V3 6-stars: Ho-Oh, Solgaleo, Lunala, Greninja, Zeraora, Keldeo = PE + all 6 stats + move EXACT match. Lugia, Eternatus, Grimmsnarl, Zygarde, Great Tusk = intl-rebalanced (no JP twin, stats differ ~12-25%).
- Bulbapedia does NOT yet have per-tag pages for the intl Stardust 1-x series (Frienda pages use the same id pattern - do not confuse).
- Note: JP Bulbapedia IDs (2-x, 3-x, 4-x) are a different id space from intl Stardust (1-x).

## 3. Official Takara Tomy site (world.pokemonmezastar.com)
- `docs/data/official_set_lists.json` - authoritative ID + name + grade for every tag in Stardust V1-V4 (70 each), scraped via Playwright (site is a JS SPA).
- VALIDATION: our V3 roster matches official 70/70 with zero name diffs. V2 missing 3 tags (1-2-034 Torterra, 1-2-037 Infernape, 1-2-040 Empoleon). V1 in pool is intentionally partial (7/70).
- V4 (Stardust Ver.4, Dec 2025, 70 tags: Dialga, Palkia, Xerneas, Yveltal, Calyrex x2, Mimikyu, Kyurem x2, Rayquaza, ...) NOT yet in pool.json - next data task when Khanh starts seeing V4 tags.

## 4. Other sources scouted (not integrated)
- HoloHoard (holohoard.app): collector checklists with images per tag, IDs confirmed. Backup for art.
- NamuWiki (pokemon tag star): release calendar (V1 Apr 2025, V2 Jun 2025, V3 Sep 2025, V4 Dec 2025, Galaxy 2026) + JP/intl differences.
-eda333.com: PE = sum of 6 stats / 5 (JP formula, matches our PE data).

## Open items
- V4 stats/moves: no source yet (official site lists names only; no stat pages). Ask arcade community / check sheet updates when V4 tags circulate in Vietnam.
- `stats_allsets.json` types column should eventually be rebuilt from pool.json for consistency.

## 5. Sheet tier lists ("Min Tags" tabs, same Google Sheet)
- Tabs S3/S4/G1/G2 Min Tags = per-TYPE coverage tier lists ("Bring any 2 of each type"), tier rows Top Tier / Great / Mediocre / Terrible, cells are tag thumbnail images.
- S3 (Khanh's version) columns: Fairy, Electric, Ground, Ghost, Dark. Ghost top = Chandelure + Lunala (matches our engine's Chandelure pick vs Solgaleo). Dark top includes Urshifu. Electric top = Zeraora + Pikachu. Images are thumbnails with Chinese tag names - full transcription pending; screenshots saved in docs/data/tierlists/.
- These tabs are OPINION/coverage guidance from the sheet author, complementary to our brute-force engine (which computes the same kind of answer from stats). Do not feed into the engine as data; use as a cross-check reference.
