// HTML character references → text, for names read out of store pages.
//
// Every importer used to carry its own short list (amp, quot, #039 …), so a store that writes
// "Pok&eacute;mon fit" (Pokémon Center, 314 products on 2026-11-11), "COSM&Eacute;TIQUE",
// "&Phi;APMAKEIO", "&ndash;" (Aniplex+) or "gMS-&Omega;" (Tamashii) left the reference in
// names.ja and from there in the Chinese and Korean names. This is the full HTML 4 set plus
// &apos;, case-sensitive (&Omega; is Ω, &omega; is ω); an unknown name is left as written.

// U+00A0–U+00FF in code point order.
const LATIN1 = (
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr " +
  "deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest " +
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml " +
  "ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig " +
  "agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml " +
  "eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml"
).split(" ");

// Α–Ω (U+0391–U+03A9, no U+03A2) and α–ω (U+03B1–U+03C9, ς is sigmaf).
const GREEK = "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigmaf Sigma Tau Upsilon Phi Chi Psi Omega".split(" ");

const OTHER = {
  quot: 34, amp: 38, apos: 39, lt: 60, gt: 62,
  OElig: 338, oelig: 339, Scaron: 352, scaron: 353, Yuml: 376, fnof: 402, circ: 710, tilde: 732,
  thetasym: 977, upsih: 978, piv: 982,
  ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206, rlm: 8207,
  ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222,
  dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230, permil: 8240, prime: 8242, Prime: 8243,
  lsaquo: 8249, rsaquo: 8250, oline: 8254, frasl: 8260, euro: 8364, image: 8465, weierp: 8472, real: 8476,
  trade: 8482, alefsym: 8501, larr: 8592, uarr: 8593, rarr: 8594, darr: 8595, harr: 8596, crarr: 8629,
  lArr: 8656, uArr: 8657, rArr: 8658, dArr: 8659, hArr: 8660, forall: 8704, part: 8706, exist: 8707,
  empty: 8709, nabla: 8711, isin: 8712, notin: 8713, ni: 8715, prod: 8719, sum: 8721, minus: 8722,
  lowast: 8727, radic: 8730, prop: 8733, infin: 8734, ang: 8736, and: 8743, or: 8744, cap: 8745, cup: 8746,
  int: 8747, there4: 8756, sim: 8764, cong: 8773, asymp: 8776, ne: 8800, equiv: 8801, le: 8804, ge: 8805,
  sub: 8834, sup: 8835, nsub: 8836, sube: 8838, supe: 8839, oplus: 8853, otimes: 8855, perp: 8869,
  sdot: 8901, lceil: 8968, rceil: 8969, lfloor: 8970, rfloor: 8971, lang: 9001, rang: 9002, loz: 9674,
  spades: 9824, clubs: 9827, hearts: 9829, diams: 9830,
};

function buildTable() {
  const table = {};
  LATIN1.forEach((name, index) => {
    table[name] = String.fromCodePoint(0xa0 + index);
  });
  GREEK.forEach((name, index) => {
    // Sigmaf has no capital: its slot (U+03A2) is unassigned, the small one is ς (U+03C2).
    if (name !== "Sigmaf") table[name] = String.fromCodePoint(0x391 + index);
    table[name === "Sigmaf" ? "sigmaf" : name.toLowerCase()] = String.fromCodePoint(0x3b1 + index);
  });
  for (const [name, code] of Object.entries(OTHER)) table[name] = String.fromCodePoint(code);
  return table;
}

export const HTML_ENTITIES = Object.freeze(buildTable());

const UPPER_ALIASES = new Set(["AMP", "QUOT", "LT", "GT"]);
const REFERENCE = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;

/** Character references → text (no tag stripping, no whitespace folding). One pass: "&amp;eacute;" → "&eacute;". */
export function decodeEntities(value = "") {
  return String(value ?? "").replace(REFERENCE, (match, ref) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (HTML_ENTITIES[ref]) return HTML_ENTITIES[ref];
    // browsers also take &AMP; &QUOT; &LT; &GT; (only these: &OMEGA; is not ω)
    return UPPER_ALIASES.has(ref) ? HTML_ENTITIES[ref.toLowerCase()] : match;
  });
}
