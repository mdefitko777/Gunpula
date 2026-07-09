# Collection Atlas

Collectible catalog and collection app for Gunpla, Armored Core, Pokemon,
Fate/FGO, and BEYBLADE X.

The project keeps product lines and individual product records in structured
JSON files, then validates, imports, and reports on that data with small Node
scripts. The static `app/` frontend reads those JSON files and presents them as
a mobile-first collection atlas instead of a database table.

## Files

- `data/grades.json` - grade, product-line, shokugan, and gashapon taxonomy.
- `data/sources.json` - source registry and source strengths/weaknesses.
- `data/kits.json` - individual kit records.
- `data/pbandai_sources.json` - Premium Bandai JP URLs for the offline crawler.
- `data/pbandai.json` - cached Premium Bandai JP products read by the static app.
- `data/pbandai_manual_products.json` - manually maintained PB/official fallback records.
- `data/market_sources.json` - market source registry for Naver, Amazon, Mandarake, Taobao, Mercari, and manual-link sources.
- `data/market_manual_links.json` - manually imported marketplace listings for sources that should not be scraped directly.
- `data/market-prices.json` - generated market summary, source status, KRW price estimates, and search templates.
- `data/search-index.json` - generated four-language keyword/search index for the app.
- `data/exchange-rates.json` - generated daily FX cache, using Frankfurter with previous-cache fallback.
- `data/image-assets.json` - generated local image asset summary.
- `data/android-package.json` - generated APK/Capacitor readiness summary.
- `schema/kit.schema.json` - kit record shape for reference.
- `docs/grades.md` - readable Chinese grade reference.
- `docs/data-model.md` - kit data model and validation rules.
- `docs/source-plan.md` - source and import strategy.
- `docs/supabase-setup.sql` - Supabase schema and RPC functions for shared sync.
- `.github/workflows/refresh-catalog.yml` - scheduled official-source refresh workflow.
- `.github/workflows/ci.yml` - syntax checks, catalog validation, and split-freshness gate on every push/PR.
- `.github/workflows/android-apk.yml` - cloud debug-APK build publishing to the `android-latest` release.
- `scripts/validate_catalog.mjs` - validates grades and kit records.
- `scripts/catalog_stats.mjs` - prints catalog counts.
- `scripts/source_coverage.mjs` - reports source coverage and missing source types.
- `scripts/search_kits.mjs` - searches kit records.
- `scripts/serve_app.mjs` - serves the local catalog UI.
- `scripts/split_catalog.mjs` - splits `data/kits.json` into per-franchise `data/split/` files the app loads progressively at startup.
- `scripts/check_app_syntax.mjs` - parse-checks the browser ES modules (`app/main.js`, `app/i18n.js`) without executing them.
- `scripts/prepare_android_www.mjs` - stages the Capacitor `www/` folder (app + data) for Android builds.
- `scripts/build_market_data.mjs` - builds market source status, keyword index, FX cache, image asset summary, and Android readiness JSON.
- `scripts/import_bandai_spirits_gunpla.mjs` - imports the Japanese official BANDAI SPIRITS Gunpla catalog.
- `scripts/import_bandai_collectibles.mjs` - imports official Bandai Candy, Bandai Gashapon, Pokemon, Armored Core, and BEYBLADE X lines.
- `scripts/import_goodsmile_fate.mjs` - imports Fate/FGO figure and goods records from Good Smile official pages.
- `scripts/import_pokemon_center_jp.mjs` - imports Pokemon Center Japan plush/toy supplement records.
- `scripts/import_pbandai_manual_products.mjs` - merges manual PB and official fallback records into the catalog.
- `scripts/crawl_pbandai.py` - safely fetches Premium Bandai JP pages into `data/pbandai.json`.
- `scripts/cache_catalog_images.mjs` - stores fragile remote cover images in a local cache or repo asset folder.
- `scripts/check_image_health.mjs` - checks whether cover and gallery image candidates still respond.
- `scripts/prune_broken_image_urls.mjs` - removes image URLs known to be broken from gallery candidates.
- `scripts/find_duplicate_candidates.mjs` - writes suspected duplicate groups to `data/duplicate-candidates.json`.
- `scripts/audit_gundam_series.mjs` - checks common Gundam series misclassification cases.
- `scripts/export_grades_markdown.mjs` - exports grades as Markdown.

## Commands

```bash
npm run validate
npm run stats
npm run sources
npm run app
npm run import:bandai
npm run import:collectibles
npm run import:fate
npm run import:pokemon-center
npm run import:pbandai-manual
npm run import:official
npm run import:data
npm run duplicates
npm run audit:gundam-series
npm run market
npm run check:images
npm run check:images:pokemon
npm run cache:catalog-images
npm run cache:pokemon-images
npm run repair:pokemon-images
npm run search -- --grade=RG
npm run search -- aerial
npm run export:grades
python scripts/crawl_pbandai.py
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd run validate
npm.cmd run stats
npm.cmd run app
npm.cmd run import:bandai
npm.cmd run import:official
npm.cmd run import:data
npm.cmd run duplicates
npm.cmd run audit:gundam-series
npm.cmd run market
```

If `python` is not on your Windows PATH, use your installed Python executable
directly. The crawler uses only the Python standard library.

## Current Status

The catalog currently validates 4,680 product records across Gundam, Armored
Core, Pokemon, Fate/FGO, and BEYBLADE X lines. Records include official product
images, release dates, JPY prices where available, source links, four-language
names, and compact series labels such as `SEED`, `00`, `W`, `Iron-Blooded
Orphans`, `Crossbone`, `Hathaway`, `FGO`, `BX`, `UX`, `CX`, and `Limited`.

The local website is static. It does not live-fetch official pages while a user
browses. Run `npm run import:official` to refresh the JSON data from Japanese
official sources; that command can later be wired to a scheduled job.

The current mobile UI is branded as Collection Atlas: a soft blue/white/green
PWA with a visual home page, bottom navigation for home/catalog/recent/market/
wanted/owned/settings, catalog browsing, and separate collection views for owned
and wanted items.

## Market Center

Run:

```bash
npm run market
```

This generates:

- `data/search-index.json` for the AI-style name/keyword organizer and advanced search.
- `data/market-prices.json` for market source status, KRW price estimates, and search links.
- `data/exchange-rates.json` using Frankfurter as a daily cached FX source.
- `data/image-assets.json` for the local image asset library summary.
- `data/android-package.json` for APK/Capacitor readiness.

The first market version is deliberately conservative:

- Naver Shop, Amazon, and Taobao are prepared as API-backed sources and show as
  ready only when their environment keys are present.
- Mandarake and Mercari are treated as low-frequency cache/VPS/manual sources.
- Xianyu, Pinduoduo, 번개장터, 중고나라, and 쿠팡 start as manual-link imports in
  `data/market_manual_links.json`.
- The static frontend does not scrape marketplace pages directly.
- Prices are converted to KRW and displayed with both normal and conservative estimates.

To add a manual market sample, copy the example shape from
`data/market_manual_links.json` into the `listings` array, then run
`npm run market`. The app will show the imported sample on the product detail
page and update the market center counts.

## Premium Bandai JP Cache

The frontend does not crawl or fetch `p-bandai.jp` directly. Premium Bandai JP
can block non-Japan IPs, so PB data is handled as:

1. Edit `data/pbandai_sources.json` with PB product or category URLs.
2. Run `python scripts/crawl_pbandai.py` on a Japan-based machine or VPS.
3. Commit or upload the generated `data/pbandai.json`.
4. GitHub Pages serves the static app, and the app reads only `data/pbandai.json`.

The crawler uses low-frequency requests, timeouts, one retry by default, and a
local HTML cache under `work/pbandai_cache`. It does not implement login bypass,
CAPTCHA bypass, proxy rotation, or hidden anti-bot bypass. If Premium Bandai
redirects or blocks the request, the crawler writes `fetch_status: "blocked"`
with an error message and still exits cleanly.

Manual fallback is supported in two places:

1. Add simple display-only cache records directly in `data/pbandai.json`.
2. Add catalog records in `data/pbandai_manual_products.json`, then run
   `npm run import:pbandai-manual`.

Set `"manual": true` in `data/pbandai.json` if you want the PB cache generator
to keep that record when a later fetch is blocked or errors. A successful fetch
for the same item can replace it.

The Node PB index importer also links existing catalog records to PB item URLs
when official Bandai/PB pages expose those links. The current generated PB cache
includes Gunpla PB records plus manual Armored Core PB records, while still
avoiding frontend requests to `p-bandai.jp`.

GitHub Pages cannot run crawler code. A Japan VPS can run it daily and push the
changed JSON back to GitHub. Example cron, not enabled automatically:

```cron
20 4 * * * cd /srv/Gunpula && python scripts/crawl_pbandai.py && git add data/pbandai.json && git commit -m "Refresh Premium Bandai JP cache" && git push
```

The UI supports local manual corrections in the browser. Corrections are stored
in `localStorage` and can be exported as JSON from a product detail view.

`npm run cache:catalog-images` writes fragile official cover images to
`../image-cache/catalog` by default, or to `IMAGE_CACHE_DIR` if that environment
variable is set. Use `npm run cache:pokemon-images` to cache Pokemon covers into
`app/assets/catalog/pokemon` and rewrite the catalog to prefer local assets. If
the first official cover URL fails, the cache script tries the same product's
gallery candidates before giving up. `npm run check:images:pokemon` writes
`data/image-health.json`, which the app settings page shows as an image health
summary. `npm run repair:pokemon-images` runs the full cache, check, broken URL
prune, and re-check loop for Pokemon images.

## Android App / PWA

The `app/` UI is installable as an Android PWA. Open the hosted `/app/` URL in
Chrome on Android and use **Add to Home screen** / **Install app**. The service
worker caches the app shell, catalog JSON, PB cache JSON, and product images
that have been opened, so the app remains usable when the network or official
image URLs are unreliable.

For a real APK, wrap the same web app with Capacitor. A base
`capacitor.config.json` is included. The generated `data/android-package.json`
and the Market Center show whether the Android project exists.

```bash
npm run android:status
npm run android:add
npm run android:sync
npm run android:build
```

`npm run android:add` is a one-time setup command. Building the APK requires a
machine with Android Studio/JDK/Android SDK installed; GitHub Pages itself cannot
build or serve a native APK.

## Shared Supabase Sync

Run `docs/supabase-setup.sql` once in Supabase SQL Editor. Then open the app
settings and fill:

- Supabase URL
- Supabase anon key
- Workspace ID
- Shared password
- Optional editor password
- Member name

Users with the same Workspace ID share collection status, wanted list, manual
corrections, and series-name corrections. Users with another Workspace ID stay
independent. If an editor password is set, only devices that know it can upload
changes; read-only devices can still view the shared state.

Conflict behavior is intentionally simple for now: the latest sync wins, while
`gunpula_workspace_events` keeps a revision history in Supabase.

## Scheduled Updates

The GitHub Actions workflow `refresh-catalog.yml` runs `npm run import:official`,
`npm run updates`, `npm run market`, `npm run validate`, `npm run duplicates`,
and `npm run audit:gundam-series` once a day. If official Japanese source data
changes, the workflow commits the refreshed JSON, market/search data, and cached
assets back to the repository.

## Next Steps

1. Review `data/duplicate-candidates.json` and merge real duplicates.
2. Manually review collectible records still marked as `other`, `mixed`, or `option`.
3. Expand Fate, Pokemon, and PB historical imports as more official source pages are identified.
4. Expand the Gundam series audit rules when a new recurring misclassification is found.
5. Move image caching from local-computer backup to a hosted cache if official hotlinking becomes unstable.
