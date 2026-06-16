# Gunpula

Gunpla catalog data project.

The project keeps Gunpla grades/model lines and individual kit records in
structured JSON files, then validates and reports on that data with small Node
scripts. The long-term goal is to support automated imports from trusted catalog
sources instead of hand-entering every kit.

## Files

- `data/grades.json` - grade and model-line taxonomy.
- `data/kits.json` - individual kit records.
- `schema/kit.schema.json` - kit record shape for reference.
- `docs/grades.md` - readable Chinese grade reference.
- `docs/data-model.md` - kit data model and validation rules.
- `docs/source-plan.md` - source and import strategy.
- `scripts/validate_catalog.mjs` - validates grades and kit records.
- `scripts/catalog_stats.mjs` - prints catalog counts.
- `scripts/search_kits.mjs` - searches kit records.
- `scripts/export_grades_markdown.mjs` - exports grades as Markdown.

## Commands

```bash
npm run validate
npm run stats
npm run search -- --grade=RG
npm run search -- aerial
npm run export:grades
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd run validate
npm.cmd run stats
```

## Current Status

This is v0.1 of the catalog foundation. `data/grades.json` contains the first
grade taxonomy, and `data/kits.json` contains seed records that prove the data
model and scripts work. Seed records are not complete verified catalog entries.

## Next Steps

1. Build the first importer for one source, likely Dalong or Bandai Hobby.
2. Import HG/MG/RG/PG/EG ordinary retail kits as `needs_review`.
3. Review imported records and promote checked records to `verified`.
4. Add a filterable website or app view once the data volume is useful.
