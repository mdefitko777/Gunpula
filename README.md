# Gunpula

Gunpla catalog starter project.

This first version focuses on the grade/model-line taxonomy: HG, MG, RG,
PG, EG, SD, and related historical or special lines. The goal is to make the
grade list reusable before adding individual kit records.

## Files

- `data/grades.json` - structured grade and model-line data.
- `docs/grades.md` - readable Chinese reference table.
- `scripts/export_grades_markdown.mjs` - exports the JSON data as a Markdown table.

## Next Steps

1. Add individual model kits with a `grade_code` that matches `data/grades.json`.
2. Add source-specific importers for Bandai Hobby, Dalong, or store pages.
3. Build a filterable catalog view once the core data shape is stable.
