// Wikitext table parser for import_wiki_gap_fillers.mjs (pinned ja.wikipedia
// list-article revisions), kept apart so the unit tests can load it.

export function cleanWiki(value) {
  return String(value ?? "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{0\}\}/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:[^\s\]]+\s*([^\]]*)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function splitCellAttributes(cell) {
  const match = /^\s*((?:[a-z]+\s*=\s*"[^"]*"\s*)+)\|(?!\|)([\s\S]*)$/i.exec(cell);
  return match ? { attrs: match[1], text: match[2] } : { attrs: "", text: cell };
}

// Rows of every wikitable between `start` and `end`, with rowspan cells carried down.
export function parseWikiTables(content, start, end) {
  const lines = content.split("\n");
  const from = Math.max(0, lines.findIndex((line) => start.test(line)));
  const rows = [];
  let heading = null;
  let table = null;
  let cells = null;
  const flush = () => {
    if (!table || !cells) return;
    const out = [];
    let index = 0;
    for (let column = 0; column < Math.max(table.columns, 1) || index < cells.length; column += 1) {
      const pending = table.pending[column];
      if (pending && pending.remaining > 0) {
        out.push(pending.text);
        pending.remaining -= 1;
        continue;
      }
      if (index >= cells.length) break;
      const { attrs, text } = splitCellAttributes(cells[index]);
      index += 1;
      const span = Number(/rowspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] || 1);
      if (span > 1) table.pending[column] = { text, remaining: span - 1 };
      out.push(text);
    }
    if (out.length) rows.push({ heading, cells: out.map(cleanWiki) });
    cells = null;
  };
  for (let n = from + 1; n < lines.length; n += 1) {
    const line = lines[n];
    if (!table && end.test(line)) break;
    const headingMatch = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line);
    if (headingMatch && !table) {
      heading = headingMatch[2];
      continue;
    }
    if (/^\{\|/.test(line)) {
      table = { pending: [], columns: 0 };
      continue;
    }
    if (!table) continue;
    if (/^\|\}/.test(line)) {
      flush();
      table = null;
      continue;
    }
    if (/^\|-/.test(line)) {
      flush();
      cells = [];
      continue;
    }
    if (/^!/.test(line)) {
      table.columns = line.replace(/^!/, "").split("!!").length;
      continue;
    }
    if (/^\|/.test(line)) {
      cells = cells || [];
      cells.push(...line.replace(/^\|/, "").split("||"));
      continue;
    }
    if (cells?.length) cells[cells.length - 1] += `\n${line}`;
  }
  return rows;
}
