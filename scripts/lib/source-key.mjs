// Key for "is this still the product name that was translated?" (names-ko.json / names-zh.json src).
// Shops respell a name without changing the product: Pokémon Center wrote "Pok&eacute;mon fit …"
// until 2026-11-10 and "ポケモン fit …" from 2026-11-11, which dropped 27 curated Korean and 30
// Chinese names back to Japanese. Entities, width, case, spaces and the Pokémon / ポケモン
// spelling do not count as a rename; any other change does.
import { decodeEntities } from "./html-entities.mjs";

export function sourceKey(name) {
  return decodeEntities(String(name || ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/pok[eé]mon|ポケモン/g, "pokemon")
    .replace(/\s+/g, "");
}

export function sameSource(a, b) {
  return sourceKey(a) === sourceKey(b);
}
