# Hobby Atlas — Pokémon MEZASTAR / 포켓몬태그스타 dataset

Builds two phone-sized, compact JSON files for the Hobby Atlas app:

| File | Edition | Printings |
|---|---|---|
| `data/atlas/mezastar-intl.json` | `mz-intl` — the international serial space (2025-), shared by HK/SG/MY/ID (EN), Taiwan (TC), Korea (KR) and mainland China (SC) | `KR`, `TC`, `EN` |
| `data/atlas/mezastar-jp.json` | `mz-jp` — the original Japanese ポケモンメザスタ (2020-2024, 19 sets, frozen) | `JA` |

```
node scripts/atlas/mezastar/build.mjs [--edition=all|intl|jp] [--kr-popups=new|all|none] [--out=data/atlas] [--report=file] [--reassign-ids]
node scripts/atlas/mezastar/check.mjs data/atlas/mezastar-intl.json data/atlas/mezastar-jp.json [--against=HEAD]
node --test scripts/atlas/mezastar/test/*.test.mjs
```

Node 20+, no dependencies. Weekly in CI via `.github/workflows/atlas-mezastar.yml` (unit tests, build, check against
the committed revision, then commits only `data/atlas/mezastar-*`).

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
| PokeAPI CSV at a pinned commit (`lib/pokeapi.mjs` `POKEAPI_SHA`): `pokemon_species_names`, `pokemon`, `pokemon_types`, `types`, `pokemon_forms`, `pokemon_form_names` | static CSV | dex numbers, ko/ja/zh-Hant/en fallback names incl. form names, form markers in TC/KR names, form-aware types, name validation |

Politeness: one User-Agent `HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)`, ≥1.1 s between
requests per host, raw responses cached in `ATLAS_CACHE_DIR` (default `tmp/atlas-cache/mezastar`, git-ignored).
A 403/429/503/511 or challenge page marks the host as **blocked**; nothing is retried with other headers, and the
block is remembered in `<cache>/_blocked-hosts.json`, so later runs do not contact that host for
`ATLAS_BLOCK_BACKOFF_DAYS` (default 28) and use cached responses instead (`ATLAS_IGNORE_BACKOFF=1` forces one try).
When Bulbapedia is unavailable the 20 JP archive pages are not fetched either (the frozen JP file cannot change
without it). Images are stored as URLs only (hotlink), never downloaded. PokeAPI is pinned so upstream edits cannot
change names or types between runs; bump `POKEAPI_SHA` (or set `ATLAS_POKEAPI_SHA`) deliberately.

**Keep previous data.** If a source fails (blocked, down, or suddenly returns <60 % of the rows it had before),
its printings, names, forms, grades, releases and anomalies are carried over from the previous output file and its
`sources[].status` says so. The JP edition is frozen: if the archive or Bulbapedia is unavailable the previous
`mezastar-jp.json` is kept unchanged. `ATLAS_BULBA_SEED_DIR` can point at a folder of earlier API responses
(one JSON per page) used only when Bulbapedia is unreachable. `ATLAS_SIMULATE_FAIL=TC,KR,EN,CN` tests the path.
Files are rewritten only when their content changed (timestamps and free-text source error messages are ignored;
a change of a source's `status` counts).

## Ids (what the app stores)

Printing ids are what the app keeps in the collection (one owned item per language printing), so they must not move.

* **Tags.** `mz-intl:1-1-001`, `mz-intl:R-1-1` (printed serial). Legacy: `mz-intl:L-1-3-1` (community code from
  mezastar-dex) or, while no code is known, `mz-intl:L-2-2-lunala` (species, own namespace: never a number).
  Promos: `mz-intl:P-G-001` (community code; an official TC promo is joined to it when exactly one community promo of
  that species/form is unclaimed and exactly one TC promo fits it — flagged as not confirmed) or
  `mz-intl:P-TC-urshifu-rapid-strike-1` (TW-only; `n` counts that species in TW release order). JP: `mz-jp:4-5-001`,
  `mz-jp:4-5-005G` (gorgeous), `mz-jp:4-2-U01` (ultra beast), `mz-jp:3-1-L-3-004` (legacy reprint of `3-004` in
  Double Chain 1), `mz-jp:P-001`…`P-146` (official promo image number, query strings/suffixes ignored),
  `mz-jp:P-<species>-<campaign>` (Bulbapedia-only promo).
* **Printings.** `<tag>@<region>`; regular tags always `<tag>@<region>:<first set of that printing>` (art changes per set);
  JP promo variants `<tag>@JA:<campaign>`. A community placeholder printing (`src: "community"`) and a later official
  printing of the same region are the same physical tag and share the id. Only a real collision adds `:<set>`, then `~2`.
* **Never moved.** The previous output is the registry: ids that came from a heuristic (synthetic legacy ids, promo
  joins, TW promo numbers) are kept for the same image URL (front or back). When a tag is renamed (e.g. a legacy tag
  gets its community code) the old ids go to the top-level `aliases` map `{old id: new id}`, kept forever; the app
  migrates stored ids through it. An id that is no longer produced and has no alias is carried over with
  `delisted: true`. The build refuses to write a file with duplicate ids, ids that do not start with `<tag>@<region>`,
  dangling aliases, or a previously published id that no longer resolves; `check.mjs --against=<ref>` runs the same
  check in CI. `--reassign-ids` ignores the previous ids (only for files that were never published).

## Output schema (`schema: 1`)

```
{ schema, updated_at, edition{id, name{}, regions{}, id_scheme, notes?},
  sources:[{name, url, licence, role, status, error?, fetched_at?, seed_snapshot_at?}],
  sets:[{id, ordinal, series, names{en?,zh_hant?,zh?,ko?,ja?},
         releases:[{region, local_name, date?, url, checklist?, news?, legacy_date?, legacy_news?, wiki?}],
         counts{total, standard?, regular?, legacy?, promo?, gorgeous?, by_region{KR?,TC?,EN?,JA?}}, anomalies?}],
  tags:[{id, serial?, code?, kind, grade?, grade_src?, grade_group, dex, form?, form_src?, types[], orientation?,
         names{ko,ja,en,zh_hant,zh?}, names_derived?[], sets[], base?, reprint_of?, promo_campaign?, promo_variant?,
         printings:[{id, region, name, img_front?, img_back?, img_thumb?, sets?, url?, variant?, kira?, src?, name_from?, delisted?}],
         stats?{hp,atk,def,spa,spd,spe,energy}, move?{name,type}, move2?, gimmick?, code_source?, anomalies?[], delisted?}],
  aliases?{<old id>: <new id>} }
```

* **kind**: `standard | regular | legacy | promo | gorgeous`. **grade_group**: `superstar | star | normal | regular |
  legacy | promo | ultra_beast | special` (JP とくべつなタグ).
* **grade** (international): KR exact ★ > CN exact ★ > mezastar-dex > grade group (★6/★5 only); `grade_src` says which.
  JP: Bulbapedia, cross-checked with mezastar-dex.
* **names**: the official printing name for that language when it exists (NFKC-normalised: `謎擬Q`, `星塵第1彈`; raw set
  titles stay in `releases[].local_name`). Otherwise derived from PokeAPI (listed in `names_derived`) in the official
  style: regional forms and Primal are prefixed (`알로라 식스테일`, `アローラロコン`, `阿羅拉六尾`, `Alolan Vulpix`,
  `원시가이오가`); Mega/Gigantamax/Dynamax/Crowned print the species only; other forms get the PokeAPI form name in
  brackets in ko/ja/zh-Hant (`버드렉스 (백마 탄 모습)`, `우라오스 (연격의 태세)`). Community names (`Charizard Mega X`)
  are not printed names: `names.en` and the community printing's `name` are the species, the form is in `form`.
  Official names are never changed; disagreements with PokeAPI go to `anomalies`.
  `names.zh` (Simplified, for the app's Chinese UI) is added last by `scripts/atlas/pokemon_zh_names.mjs`: the
  official zh-Hans name from `data/i18n/zh/pokemon.json` when it matches the printed zh-Hant name character for
  character, else the printed name converted character by character (`九尾 (阿羅拉的樣子)` → `九尾 (阿罗拉的样子)`).
* **form**: from the official EN name, else from form markers in the TC/KR name (`武道熊師（連擊流）` → Rapid Strike,
  `蕾冠王 (騎白馬的樣子)` → Ice Rider; `form_src: "TC name"`), else from mezastar-dex. A tag whose form no source gives,
  while the species has forms with other types, is flagged.
* **types**: international = mezastar-dex `pool.json` if curated, else PokeAPI for the form; Mega/Gigantamax/Dynamax/Primal
  keep the base types (Bulbapedia convention). JP = Bulbapedia.
* `src: "community"` printings (EN legacy/promo data from mezastar-dex) and `src: "bulbapedia"` printings (JP tags
  not on the official archive) have no official image.
* Regular tags appear in several sets; a printing lists `sets` when its art differs per set.

## App notes

* **Thumbnails.** Only KR (`img_thumb`, list images) and JA (`img_thumb`) printings have small images. TC (543) and EN
  (505) printings have full-size PNGs only (sampled: TC front ≈215 KB, EN front ≈273 KB, JA promo ≈500 KB). In grid
  views prefer `img_thumb`, else resize and cache on the device; never load hundreds of full PNGs at once.
* Show `anomalies` only in a debug/details view; promo joins and JP promo campaigns marked "not confirmed" /
  "uncertain" are heuristics.

## Attribution (show in the app)

Official data © Pokémon / Nintendo / Creatures / GAME FREAK, T-ARTS / MARV (and SEGA Taiwan, T-ARTS Korea) — metadata and
image links only, personal use. Bulbapedia (CC BY-NC-SA 2.5). mezastar-dex (MIT, khanh-aera) and its community sheet
(Kaizen Hayashi). PokeAPI (BSD-3-Clause).
