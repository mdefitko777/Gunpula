# Hobby Atlas — Pokémon MEZASTAR / 포켓몬태그스타 dataset

Builds two phone-sized, compact JSON files for the Hobby Atlas app:

| File | Edition | Printings |
|---|---|---|
| `data/atlas/mezastar-intl.json` | `mz-intl` — the international serial space (2025-), shared by HK/SG/MY/ID (EN), Taiwan (TC), Korea (KR) and mainland China (SC) | `KR`, `TC`, `EN` |
| `data/atlas/mezastar-jp.json` | `mz-jp` — the original Japanese ポケモンメザスタ (2020-2024, 19 sets, frozen) | `JA` |

```
node scripts/atlas/mezastar/build.mjs [--edition=all|intl|jp] [--kr-popups=new|all|none] [--out=data/atlas] [--report=file]
```

Node 20+, no dependencies. Weekly in CI via `.github/workflows/atlas-mezastar.yml` (commits only `data/atlas/mezastar-*`).

## Sources (in pipeline order)

| Source | Access | Gives |
|---|---|---|
| TW `api.pokemonmezastar.com.tw/api/v1/season/list` + `/season/{id}` | public JSON | TC names, front/back images, orientation, legacy (`經典卡匣`) and promo tags, release dates, PDF checklists |
| HK `world.pokemonmezastar.com/hk/tag/` (+ page ids from the version switcher) and `/hk/news/` | static HTML | EN names, grade group, front image; EN launch and legacy-event dates from news titles |
| KR `pokemontagstar.co.kr/kr/sub/stage.php` (`<select name=cate>` first) + `stage_pop_view.php?idx=N` (POST) | PHP HTML | KR names, exact ★ grade, thumbnails; front/back art from the popup (fetched only for tags not already in the previous output) |
| CN `www.pokemonmezastar.com.cn/chuckInformation?id=` `__NEXT_DATA__` | Next.js SSR | exact ★ grade only (no SC printings emitted); malformed codes and duplicated serials are normalised and logged |
| JP `takaratomy-arts.co.jp/specials/pokemonmezastar/new/{1..4,st1..5,dc1..5,gs1..5}.html`, `/new/special/` | static HTML | JA names, grade group, kira flag, full + thumbnail images, 146 promos |
| Bulbapedia MediaWiki API (`action=parse`, category `Mezastar expansion sets`, `Promotional tags (Mezastar)`, `Pokémon Mezastar`) | JSON | JP: EN species, types, exact grade, Gorgeous (`…G`), Ultra Beast (`…-U0n`) and Legacy rows, promo campaigns, set release dates; HK launch day |
| `vendor/mezastar-dex` (MIT, see its README/LICENSE) | vendored JSON | international stats/energy/moves/gimmicks, community codes for legacy/promo tags, curated types; JP stats (from Bulbapedia) |
| PokeAPI CSV (`pokemon_species_names`, `pokemon`, `pokemon_types`, `types`) | static CSV | dex numbers, ko/ja/zh-Hant/en fallback names, form-aware types, name validation |

Politeness: one User-Agent `HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)`, ≥1.1 s between
requests per host, raw responses cached in `ATLAS_CACHE_DIR` (default `tmp/atlas-cache/mezastar`, git-ignored).
A 403/429/503/511 or challenge page marks the host as **blocked** for the rest of the run; nothing is retried with
other headers. Images are stored as URLs only (hotlink), never downloaded.

**Keep previous data.** If a source fails (blocked, down, or suddenly returns <60 % of the rows it had before),
its printings, names, grades, releases and anomalies are carried over from the previous output file and its
`sources[].status` says so. The JP edition is frozen: if the archive or Bulbapedia is unavailable the previous
`mezastar-jp.json` is kept unchanged. `ATLAS_BULBA_SEED_DIR` can point at a folder of earlier API responses
(one JSON per page) used only when Bulbapedia is unreachable. `ATLAS_SIMULATE_FAIL=TC,KR,EN,CN` tests the path.
Files are rewritten only when their content (ignoring timestamps) changed.

## Output schema (`schema: 1`)

```
{ schema, updated_at, edition{id, name{}, regions{}, id_scheme, notes?},
  sources:[{name, url, licence, role, status, error?, fetched_at?}],
  sets:[{id, ordinal, series, names{ko?,ja?,en?,zh_hant?},
         releases:[{region, local_name, date?, url, checklist?, news?, legacy_date?, legacy_news?, wiki?}],
         counts{total, standard?, regular?, legacy?, promo?, gorgeous?, by_region{KR?,TC?,EN?,JA?}}, anomalies?}],
  tags:[{id, serial?, code?, kind, grade?, grade_src?, grade_group, dex, form?, form_src?, types[], orientation?,
         names{ko,ja,en,zh_hant}, names_derived?[], sets[], base?, reprint_of?, promo_campaign?, promo_variant?,
         printings:[{id, region, name, img_front?, img_back?, img_thumb?, sets?, url?, variant?, kira?, src?, name_from?}],
         stats?{hp,atk,def,spa,spd,spe,energy}, move?{name,type}, move2?, gimmick?, code_source?, anomalies?[]}] }
```

* **IDs.** `mz-intl:1-1-001`, `mz-intl:R-1-1`, `mz-intl:L-1-3-1` (legacy; community code from mezastar-dex where known,
  otherwise synthesised from the TW order — flagged), `mz-intl:P-G-001` (community promo code, EN) or
  `mz-intl:P-TC-<image hash>` (TW promo). `mz-jp:4-5-001`, `mz-jp:4-5-005G` (gorgeous), `mz-jp:4-2-U01` (ultra beast),
  `mz-jp:3-1-L-3-004` (legacy reprint of `3-004` in Double Chain 1), `mz-jp:P-001`…`P-146` (official promo image
  number), `mz-jp:P-<species>-<campaign>` (Bulbapedia-only promo). Printing ids are `<tag id>@<region>[:<set>|:<variant>]`
  and are what the app stores in the collection (one owned item per language printing).
* **kind**: `standard | regular | legacy | promo | gorgeous`. **grade_group**: `superstar | star | normal | regular |
  legacy | promo | ultra_beast | special` (JP とくべつなタグ).
* **grade** (international): KR exact ★ > CN exact ★ > mezastar-dex > grade group (★6/★5 only); `grade_src` says which.
  JP: Bulbapedia, cross-checked with mezastar-dex.
* **names**: the official printing name for that language when it exists, else the PokeAPI species name
  (listed in `names_derived`). Official names are never changed; disagreements with PokeAPI go to `anomalies`.
* **types**: international = mezastar-dex `pool.json` if curated, else PokeAPI for the form; Mega/Gigantamax/Dynamax/Primal
  keep the base types (Bulbapedia convention). JP = Bulbapedia.
* `src: "community"` printings (EN legacy/promo names from mezastar-dex) and `src: "bulbapedia"` printings (JP tags
  not on the official archive) have no official image.
* Regular tags appear in several sets; a printing lists `sets` when its art differs per set.

## Attribution (show in the app)

Official data © Pokémon / Nintendo / Creatures / GAME FREAK, T-ARTS / MARV (and SEGA Taiwan, T-ARTS Korea) — metadata and
image links only, personal use. Bulbapedia (CC BY-NC-SA 2.5). mezastar-dex (MIT, khanh-aera) and its community sheet
(Kaizen Hayashi). PokeAPI (BSD-3-Clause).
