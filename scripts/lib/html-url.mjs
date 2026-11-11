// URLs read out of HTML attributes (src="…", href="…") are still HTML-escaped:
// Aniplex+ writes "600&times;600_newcoupon.png" and "saihan_musashi&amp;miniCu/M1.jpg",
// and the escaped form answers 404. Decode the character references first, then
// let URL percent-encode what needs it (× → %C3%97; a literal & in a path is fine).

import { decodeEntities } from "./html-entities.mjs";

/** Character references in an attribute value → text (no tag stripping, no whitespace folding). */
export function decodeHtmlAttr(value = "") {
  return decodeEntities(value);
}

/** An href / src from HTML → absolute URL ("" when it cannot be one). */
export function absoluteHtmlUrl(href, base) {
  const value = decodeHtmlAttr(href || "").trim();
  if (!value) return "";
  try {
    return new URL(value.startsWith("//") ? `https:${value}` : value, base).toString();
  } catch {
    return "";
  }
}

/** An image URL that still carries an HTML character reference (&amp;, &times;, &#39; …). */
export const HTML_ENTITY_IN_URL = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;
