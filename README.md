# Gunpula

Gunpla catalog data project.

The project keeps Gunpla grades/model lines and individual kit records in
structured JSON files, then validates and reports on that data with small Node
scripts. The long-term goal is to support automated imports from Japanese
official and Japanese retail catalog sources instead of hand-entering every kit.

## Files

- `data/grades.json` - grade and model-line taxonomy.
- `data/sources.json` - source registry and source strengths/weaknesses.
- `data/kits.json` - individual kit records.
- `schema/kit.schema.json` - kit record shape for reference.
- `docs/grades.md` - readable Chinese grade reference.
- `docs/data-model.md` - kit data model and validation rules.
- `docs/source-plan.md` - source and import strategy.
- `scripts/validate_catalog.mjs` - validates grades and kit records.
- `scripts/catalog_stats.mjs` - prints catalog counts.
- `scripts/source_coverage.mjs` - reports source coverage and missing source types.
- `scripts/search_kits.mjs` - searches kit records.
- `scripts/serve_app.mjs` - serves the local catalog UI.
- `scripts/import_bandai_spirits_gunpla.mjs` - imports the Japanese official BANDAI SPIRITS Gunpla catalog.
- `scripts/export_grades_markdown.mjs` - exports grades as Markdown.

## Commands

```bash
npm run validate
npm run stats
npm run sources
npm run app
npm run import:bandai
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
```

## Current Status

The catalog currently imports 2,315 Gunpla kit records from the Japanese
official BANDAI SPIRITS product search. Records include official product
images, release dates, JPY prices, source links, and inferred work titles such
as `Mobile Suit Gundam SEED Destiny` or `Mobile Suit Gundam 00`.

The local website is static. It does not live-fetch official pages while a user
browses. Run `npm run import:bandai` to refresh the JSON data from the Japanese
official source; that command can later be wired to a scheduled job.

## Next Steps

1. Add scheduled imports so the catalog refreshes automatically.
2. Improve work-title inference and manually review records still marked as unknown.
3. Cross-check special and limited kits with Premium Bandai Japan and The Gundam Base Japan.
4. Promote reviewed records from `needs_review` to `verified`.
