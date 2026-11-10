# AGENTS.md — Gunpula

Gunpula is the data pipeline behind **Hobby Atlas** (mdefitko777/hobby-atlas-v3, a personal Android app used by
two people: the owner and their boyfriend) and the older Gunpula web catalog in `app/`. GitHub Actions read official
sites every day, build `data/`, and publish it on GitHub Pages (`.github/workflows/publish-site.yml`).
These are the rules for AI agents working here; several agents often edit in parallel, so the point is that the
result reads as if one person wrote it.

## Shape of the repo
- `scripts/` — Node ESM (`.mjs`), no build step. Importers `import_*.mjs`, derive steps (localize, apply names,
  split, feeds), `scripts/lib/` shared helpers (reuse them: `robots.mjs`, `ko-tidy.mjs`, `cached-originals.mjs` …),
  `scripts/atlas/` atlas data. `scripts/run_importers.mjs` is the daily order of steps.
- `data/kits.json` is the master catalog; the app reads `data/split/*.json` (+ `kit-aliases.json`), feeds in
  `data/atlas/notify-feed.json` and `data/update-feed-lite.json`.
- Hand-curated data (edit these, not the generated files): `data/series-overrides.json`, `data/i18n/names-ko.json`
  (later `names-zh.json`), `data/manual-images.json`, `data/atlas/notify-quiet.json`, alias sources.
- Cached photos stay in `app/assets/{catalog,kotobukiya-ac,bbx}` with `./assets/…` paths in the data; only the
  published copy points them at the image repos `gunpula-img-N` (`scripts/publish_site.mjs`, `data/image-shards.json`).

## Writing code
- Style: 2-space indent, double quotes, semicolons, `const` by default, small named functions, `async/await`.
  Match the file you are in. No new dependencies without a reason in the commit message.
- Comments in English, short, about **why**: what was measured (with a date), what failed before, why the obvious
  alternative is not used. A file starts with a few lines saying what it does and how to run it. No comments that
  restate the code.
- Names: `camelCase` functions/variables, `UPPER_SNAKE` constants, files `snake_case.mjs`. Before adding a helper,
  look in `scripts/lib/` and in the script you are changing.
- Scripts guard their `main()` with a basename check (`/(^|[\\/])name\.mjs$/.test(process.argv[1])`) so tests can
  import them.
- Fix the generating script (root cause), not only the generated data. Sticky values (series, names) do not move
  by a rule change alone: also add the hand-fix (override, alias).
- Every behaviour change gets a test: `scripts/test_*.mjs` with `node:assert/strict`, registered in
  `package.json` `test:unit`. Run `npm run -s test:unit` and `npm run validate` before committing.

## Crawling (non-negotiable)
- New code identifies itself: `HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)`, reads robots.txt
  first (`scripts/lib/robots.mjs`), one request at a time per host at least 1.1 s apart, and stops for the run on
  403 / 429 / 503 or a bot-check page. Never a browser user-agent, never a made-up Referer, never a Cloudflare or
  captcha bypass, never run a site's JavaScript. Old scripts keep their current UA (owner's decision).
- Rebrickable archives at most once a day. Frienda image URLs never go into public data.
- Never read or print `data/market_secrets.local.json`.

## Data and the app
- Keep `kit_id` stable. When a record is merged or renamed, write `old_id -> new_id` into the alias source so saved
  likes / owned entries follow (the app reads `data/split/kit-aliases.json`).
- After a bulk data change (regenerating many records), add the commit sha to `data/atlas/notify-quiet.json` so the
  app does not send hundreds of notifications. Quiet reasons live in `scripts/atlas/build_notify_feed.mjs` and the
  app's `lib/notifications/feed_rules.dart` — keep both lists in sync.
- Korean names follow the app's glossary (hobby-atlas-v3 `docs/terms.md`) for shared words.

## Commits
- English, one line saying what changed for the people who use the data ("Publish the site without the photo
  caches…"), then a body with the why and the numbers. End with the `Co-Authored-By:` line.
- Other sessions and the daily bots commit to `main` at the same time: stage only your files, `git fetch` +
  rebase before pushing, never force-push, never push to the `template` remote.
- When work was split across several agents, one session reads the whole diff and evens out names, wording and
  comments before it is committed.
