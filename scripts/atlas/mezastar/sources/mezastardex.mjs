// Vendored khanh-aera/mezastar-dex data (MIT). See ../vendor/mezastar-dex/README.md.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { nfkc } from "../lib/util.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vendor", "mezastar-dex");
export const MD_COMMIT = "c325e73ca6dfade01f48a6b3a10c2424c6134658";
export const MD_SOURCE = {
  name: "mezastar-dex data (khanh-aera) incl. community sheet by Kaizen Hayashi",
  url: `https://github.com/khanh-aera/mezastar-dex/tree/${MD_COMMIT}/data`,
  licence: "MIT (Copyright (c) 2026 khanh-aera); underlying community sheet credited to Kaizen Hayashi",
  role: "international stats, energy, moves, gimmicks, legacy/promo community codes; curated types (pool.json)",
};
export const MD_BULBA_SOURCE = {
  name: "mezastar-dex bulba_jp_reference.json (Bulbapedia per-tag pages)",
  url: `https://github.com/khanh-aera/mezastar-dex/blob/${MD_COMMIT}/data/bulba_jp_reference.json`,
  licence: "MIT packaging (khanh-aera); content from Bulbapedia, CC BY-NC-SA 2.5",
  role: "JP stats, energy and move",
};

const J = async (f) => JSON.parse(await readFile(path.join(DIR, f), "utf8"));

/** Map community id -> our id suffix ('L (1-3-1)' -> 'L-1-3-1', 'P (G-001)' -> 'P-G-001'). */
export function mdIdToLocal(id) {
  const s = nfkc(id);
  let m;
  if ((m = s.match(/^L \((\d)-(\d)-(\d+)\)$/))) return `L-${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^P \(([A-Z])-(\d+)\)$/))) return `P-${m[1]}-${m[2]}`;
  return s;
}

const cleanMove = (mv) => (mv && mv.name ? { name: nfkc(mv.name), type: nfkc(mv.type || "") || undefined } : null);

export async function loadMezastarDex() {
  const stats = await J("stats_allsets.json");
  const pool = await J("pool.json");
  const bulbaJp = await J("bulba_jp_reference.json");
  const intl = new Map();
  for (const x of stats) {
    const grade = Number((String(x.rarity).match(/^(\d)\s*★/) || [])[1]) || null;
    intl.set(mdIdToLocal(x.id), {
      md_id: x.id,
      name: nfkc(x.name),
      rarity: x.rarity,
      grade,
      gimmick: x.gimmick || null,
      sheet_types: x.types || [],
      stats: { hp: x.hp, atk: x.atk, def: x.def, spa: x.spa, spd: x.spd, spe: x.spe, energy: x.pe },
      move: cleanMove(x.move1),
      move2: cleanMove(x.move2),
    });
  }
  const poolTypes = new Map((pool.tags || []).map((t) => [t.id, (t.types || []).map(nfkc)]));
  const jp = new Map();
  for (const [serial, t] of Object.entries(bulbaJp.tags || {})) {
    jp.set(serial, {
      stats: { hp: t.hp, atk: t.atk, def: t.def, spa: t.spa, spd: t.spd, spe: t.spe, energy: t.energy },
      move: t.move ? { name: nfkc(t.move), type: nfkc(t.movetype || "") || undefined } : null,
      grade: Number(t.grade) || null,
      name: t.name,
    });
  }
  return { intl, poolTypes, jp };
}
