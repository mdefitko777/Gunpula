# Gunpula

Gunpla catalog data project.

The project keeps Gunpla grades/model lines and individual kit records in
structured JSON files, then validates and reports on that data with small Node
scripts. The long-term goal is to support automated imports from Japanese
official and Japanese retail catalog sources instead of hand-entering every kit.

## Files

- `data/grades.json` - grade, product-line, shokugan, and gashapon taxonomy.
- `data/sources.json` - source registry and source strengths/weaknesses.
- `data/kits.json` - individual kit records.
- `schema/kit.schema.json` - kit record shape for reference.
- `docs/grades.md` - readable Chinese grade reference.
- `docs/data-model.md` - kit data model and validation rules.
- `docs/source-plan.md` - source and import strategy.
- `docs/supabase-setup.sql` - Supabase schema and RPC functions for shared sync.
- `.github/workflows/refresh-catalog.yml` - scheduled official-source refresh workflow.
- `scripts/validate_catalog.mjs` - validates grades and kit records.
- `scripts/catalog_stats.mjs` - prints catalog counts.
- `scripts/source_coverage.mjs` - reports source coverage and missing source types.
- `scripts/search_kits.mjs` - searches kit records.
- `scripts/serve_app.mjs` - serves the local catalog UI.
- `scripts/import_bandai_spirits_gunpla.mjs` - imports the Japanese official BANDAI SPIRITS Gunpla catalog.
- `scripts/import_bandai_collectibles.mjs` - imports official Bandai Candy, Bandai Gashapon, Pokemon, Armored Core, and BEYBLADE X lines.
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
npm run import:official
npm run duplicates
npm run audit:gundam-series
npm run check:images
npm run check:images:pokemon
npm run cache:catalog-images
npm run cache:pokemon-images
npm run repair:pokemon-images
npm run search -- --grade=RG
npm run search -- aerial
npm run export:grades
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd run validate
npm.cmd run stats
npm.cmd run app
npm.cmd run import:bandai
npm.cmd run import:official
npm.cmd run duplicates
npm.cmd run audit:gundam-series
```

## Current Status

The catalog currently validates 4,454 product records across Gundam, Armored
Core, Pokemon, and BEYBLADE X lines. Records include official product images,
release dates, JPY prices where available, source links, four-language names,
and compact series labels such as `SEED`, `00`, `W`, `Iron-Blooded Orphans`,
`Crossbone`, `Hathaway`, `BX`, `UX`, `CX`, and `Limited`.

The local website is static. It does not live-fetch official pages while a user
browses. Run `npm run import:official` to refresh the JSON data from Japanese
official sources; that command can later be wired to a scheduled job.

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
worker caches the app shell, catalog JSON, and product images that have been
opened, so the app remains usable when the network or official image URLs are
unreliable.

For a Play Store-style APK later, wrap the same web app with Capacitor after the
Supabase settings are finalized. A base `capacitor.config.json` is included; run
`npm run android:sync` after adding Capacitor packages and the Android platform.

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
`npm run validate`, `npm run duplicates`, and `npm run audit:gundam-series` once
a day. If official Japanese source data changes, the workflow commits the
refreshed JSON and cached assets back to the repository.

## Next Steps

1. Review `data/duplicate-candidates.json` and merge real duplicates.
2. Manually review collectible records still marked as `other`, `mixed`, or `option`.
3. Expand the Gundam series audit rules when a new recurring misclassification is found.
4. Move image caching from local-computer backup to a hosted cache if official hotlinking becomes unstable.
