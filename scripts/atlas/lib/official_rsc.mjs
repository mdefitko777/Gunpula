// Parse GUNDAM Official Website (Next.js app router) series pages: join the RSC flight chunks
// and pull the episode lists (episodes_connection + addSeasons) out of the series object.

export function rscText(html) {
  let text = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/gs)) {
    try {
      text += JSON.parse(m[1]);
    } catch {
      /* skip malformed chunk */
    }
  }
  return text;
}

/** JSON value (array or object) that starts at text[start], scanned string-aware. */
export function jsonAt(text, start) {
  const open = text[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try {
        return { value: JSON.parse(text.slice(start, i + 1)), end: i + 1 };
      } catch {
        return null;
      }
    }
  }
  return null;
}

const episodeRows = (nodes) =>
  (nodes || [])
    .filter((n) => n && Number.isFinite(n.episodeNumber))
    .map((n) => ({ n: n.episodeNumber, id: n.documentId, ja: String(n.subtile || "").trim() }));

export function parseSeries(text, slug) {
  // The page can mention other series (related works); the right block is the one whose
  // object carries `"slug":"<slug>"` closest after the episode list.
  const blocks = [];
  const re = /"(addSeasons|episodes_connection)":/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const parsed = jsonAt(text, start);
    if (!parsed) continue;
    re.lastIndex = parsed.end;
    if (m[1] === "addSeasons") {
      const seasons = (Array.isArray(parsed.value) ? parsed.value : []).map((s) => episodeRows(s?.episodes_connection?.nodes)).filter((x) => x.length);
      blocks.push({ kind: "add", at: m.index, seasons });
    } else {
      blocks.push({ kind: "main", at: m.index, episodes: episodeRows(parsed.value?.nodes) });
    }
  }
  const titleMatch = text.match(new RegExp(`"title":"((?:[^"\\\\]|\\\\.)*)","slug":"${slug.replace(/[-]/g, "\\-")}"`));
  const title = titleMatch ? JSON.parse(`"${titleMatch[1]}"`) : null;
  // First main block with episodes, plus the addSeasons block right before it.
  const mainIdx = blocks.findIndex((b) => b.kind === "main" && b.episodes.length);
  const seasons = [];
  if (mainIdx >= 0) {
    seasons.push(blocks[mainIdx].episodes);
    const prev = blocks[mainIdx - 1];
    if (prev?.kind === "add") seasons.push(...prev.seasons);
  }
  // Drop duplicate documentIds across seasons (the page repeats some lists).
  const seen = new Set();
  const clean = seasons
    .map((eps) => eps.filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).sort((a, b) => a.n - b.n))
    .filter((eps) => eps.length);
  return { title, seasons: clean };
}
