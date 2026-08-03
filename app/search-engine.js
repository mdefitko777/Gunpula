const GENERIC_TOKENS = new Set([
  "mobile", "suit", "gundam", "model", "kit", "figure", "series", "the", "of",
  "机动战士", "機動戦士", "高达", "鋼彈", "건담", "ガンダム",
]);
const GENERIC_ALIAS_ENTITIES = new Set(["armored core 6", "armored core 4 answer", "pokemon", "nendoroid", "fate grand order", "beyblade x", "premium bandai"]);

const PRODUCT_LINES = [
  "mgex", "mg", "rg", "hguc", "hg", "pg", "eg", "sdcs", "sd", "mgsd", "fm",
  "metal build", "metal robot", "robot spirits", "robot魂", "r魂", "mr魂", "mb",
  "nendoroid", "黏土人", "ねんどろいど", "넨도로이드", "figma", "shf", "converge",
  "gframe", "g frame", "artifact", "v.i.", "vi", "bx", "cx", "ux",
];

export const SEARCH_ALIAS_GROUPS = [
  ["mighty strike freedom", "强袭自由二式", "强自二式", "マイティーストライクフリーダム", "마이티 스트라이크 프리덤"],
  ["strike freedom", "强袭自由", "強襲自由", "强自", "sf", "ストライクフリーダム", "스트라이크 프리덤"],
  ["freedom", "自由", "フリーダム", "프리덤"],
  ["rising freedom", "升扬自由", "라이징 프리덤", "ライジングフリーダム"],
  ["destiny", "命运", "命運", "デスティニー", "데스티니"],
  ["infinite justice", "无限正义", "無限正義", "インフィニットジャスティス", "인피니트 저스티스"],
  ["justice", "正义", "正義", "ジャスティス", "저스티스"],
  ["exia", "能天使", "エクシア", "엑시아"],
  ["00 qant", "00 qan t", "00q", "量子型", "クアンタ", "퀀터"],
  ["aerial", "风灵", "風靈", "エアリアル", "에어리얼"],
  ["barbatos", "巴巴托斯", "バルバトス", "발바토스"],
  ["unicorn", "独角兽", "獨角獸", "ユニコーン", "유니콘"],
  ["sazabi", "沙扎比", "サザビー", "사자비"],
  ["white glint", "white glint", "白闪", "白色闪光", "ホワイトグリント", "ホワイト グリント", "화이트 글린트"],
  ["steel haze", "钢铁迷雾", "スティールヘイズ", "스틸 헤이즈"],
  ["armored core 6", "armored core vi", "ac6", "ac vi", "fires of rubicon", "境界天火", "ルビコンの火", "루비콘의 화염"],
  ["armored core 4 answer", "armored core for answer", "acfa", "ac for answer", "フォーアンサー", "포 앤서"],
  ["pokemon", "pokémon", "宝可梦", "寶可夢", "ポケモン", "포켓몬"],
  ["pikachu", "皮卡丘", "ピカチュウ", "피카츄"],
  ["nendoroid", "黏土人", "粘土人", "ねんどろいど", "넨도로이드"],
  ["artoria", "altria", "阿尔托莉雅", "阿爾托莉雅", "アルトリア", "알트리아", "saber", "セイバー", "세이버"],
  ["fate grand order", "fgo", "命运冠位指定", "フェイトグランドオーダー", "페이트 그랜드 오더"],
  ["beyblade x", "bbx", "ベイブレードx", "베이블레이드 x", "爆旋陀螺x"],
  ["premium bandai", "p bandai", "pbandai", "pb", "プレミアムバンダイ", "프리미엄 반다이", "魂限"],
];

const OWNER_PATTERNS = {
  self: /我的|本人|내가|나의|私の|自分の|\b(?:my|mine)\b/giu,
  other: /对方|朋友|好友|另一方|상대|친구|相手|友達|\b(?:other|friend|partner)\b/giu,
};

const COLLECTION_PATTERNS = {
  owned: /(?:已购买|已購買|拥有|擁有|购入|購入済み|持っている|구매함|보유|소장|owned|have)/giu,
  wanted: /(?:想要|愿望|願望|欲しい|원함|위시|wanted|wishlist|want)/giu,
};

const LIMITED_PATTERN = /(?:限定|限量|抽选|抽選|limited|exclusive|한정)/giu;

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/(\d)\s*[/／]\s*(\d)/g, "$1/$2")
    .replace(/\bver(?:sion)?\s*\.?\s*(\d)/g, "ver $1")
    .replace(/[<>【】\[\]{}()（）"'“”‘’・·:：\\|,，.!！?？#_+＝=~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseIn(text, phrase) {
  if (!text || !phrase) return false;
  if (phrase.length <= 2 && /^[a-z0-9]+$/i.test(phrase)) {
    return text.split(" ").includes(phrase);
  }
  return text.includes(phrase);
}

export function aliasVariants(value) {
  const text = normalizeSearchText(value);
  const variants = new Set(text ? [text] : []);
  for (const group of SEARCH_ALIAS_GROUPS) {
    const normalized = group.map(normalizeSearchText);
    if (normalized.some((term) => phraseIn(text, term))) normalized.forEach((term) => variants.add(term));
  }
  return [...variants].filter(Boolean);
}

function removePattern(text, pattern) {
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

export function parseSearchQuery(rawQuery) {
  const normalized = normalizeSearchText(rawQuery);
  let remaining = ` ${normalized} `;
  let owner = null;
  let collection = null;
  for (const [key, pattern] of Object.entries(OWNER_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(remaining)) owner = key;
    pattern.lastIndex = 0;
    remaining = removePattern(remaining, pattern);
  }
  for (const [key, pattern] of Object.entries(COLLECTION_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(remaining)) collection = key;
    pattern.lastIndex = 0;
    remaining = removePattern(remaining, pattern);
  }
  if (owner && !collection) collection = "owned";
  LIMITED_PATTERN.lastIndex = 0;
  const limited = LIMITED_PATTERN.test(remaining);
  LIMITED_PATTERN.lastIndex = 0;
  if (limited) remaining = removePattern(remaining, LIMITED_PATTERN);
  const lines = PRODUCT_LINES.filter((line) => phraseIn(remaining, normalizeSearchText(line)));
  const clean = normalizeSearchText(remaining);
  const tokens = clean.split(" ").filter(Boolean);
  return {
    raw: String(rawQuery || "").trim(),
    normalized,
    text: clean,
    tokens,
    variants: aliasVariants(clean),
    tokenVariants: tokens.map(aliasVariants),
    owner,
    collection,
    limited,
    productLines: lines,
  };
}

function unique(values) {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(normalizeSearchText).filter(Boolean))];
}

function usefulEntityName(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => !GENERIC_TOKENS.has(token) && !PRODUCT_LINES.includes(token) && !/^1\/\d+$/.test(token) && !/^ver$/.test(token))
    .filter((token) => !/^\d{4}(?:-\d{1,2})?$/.test(token))
    .join(" ")
    .replace(/\b(?:clear|color|limited|edition|set|parts|option|reissue)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalEntity(values, fallback) {
  const haystack = values.join(" ");
  for (const group of SEARCH_ALIAS_GROUPS) {
    if (GENERIC_ALIAS_ENTITIES.has(group[0])) continue;
    const normalized = group.map(normalizeSearchText);
    if (normalized.some((term) => phraseIn(haystack, term))) {
      return { name: group[0], key: normalizeSearchText(group[0]) };
    }
  }
  const code = haystack.match(/\b(?:rx|msn|msm|rgm|rms|amx|zgmf|mbf|gn|asw g|xxxg)\s*[a-z0-9]+(?:\s+[a-z0-9]+){0,2}\b/i)?.[0];
  if (code) return { name: code.toUpperCase(), key: normalizeSearchText(code) };
  const name = usefulEntityName(fallback);
  return { name: fallback, key: name || normalizeSearchText(fallback) };
}

export function createSearchDocument(item, indexed = {}, extra = {}) {
  const names = unique([indexed.names, indexed.display_name, item?.names && Object.values(item.names), extra.names]);
  const aliases = unique([indexed.aliases, indexed.keywords, extra.aliases]);
  const series = unique([indexed.series_terms, indexed.series_key, item?.series?.key, item?.series?.labels && Object.values(item.series.labels), item?.work_title, item?.universe, extra.series]);
  const lines = unique([indexed.line_terms, indexed.product_line, item?.grade_code, item?.subline, item?.scale, extra.lines]);
  const codes = unique([indexed.code_terms, item?.kit_id, item?.number, item?.jan_code, item?.product_code, extra.codes]);
  const tags = unique([item?.tags, extra.tags]);
  const all = unique([names, aliases, series, lines, codes, tags, indexed.search_blob, item?.franchise]);
  const entityFallback = indexed.entity_name || extra.entityName || names[0] || item?.kit_id || "";
  const entity = canonicalEntity([...names, ...aliases], entityFallback);
  return {
    id: item?.kit_id || indexed.kit_id || extra.id || "",
    item,
    names,
    aliases,
    series,
    lines,
    codes,
    tags,
    all,
    entityName: entity.name,
    entityKey: entity.key || indexed.entity_key || normalizeSearchText(item?.kit_id),
    limited: Boolean(item?.is_limited || indexed.is_limited),
  };
}

function boundedEditDistance(a, b, maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[b.length];
}

function fieldMatch(values, term, allowFuzzy = true) {
  let best = 0;
  for (const value of values) {
    if (value === term) best = Math.max(best, 4);
    else if (value.startsWith(term)) best = Math.max(best, 3);
    else if (phraseIn(value, term)) best = Math.max(best, 2);
    else if (allowFuzzy && term.length >= 4) {
      const maxDistance = term.length >= 5 ? 2 : 1;
      const words = value.split(" ").filter((word) => Math.abs(word.length - term.length) <= maxDistance);
      if (words.some((word) => boundedEditDistance(word, term, maxDistance) <= maxDistance)) best = Math.max(best, 1);
    }
  }
  return best;
}

export function scoreSearchDocument(document, query, options = {}) {
  const parsed = typeof query === "string" ? parseSearchQuery(query) : query;
  const allowFuzzy = options.allowFuzzy !== false;
  if (!parsed.text && !parsed.limited && !parsed.productLines.length) return { score: 1, reasons: [] };
  if (parsed.limited && !document.limited) return { score: 0, reasons: [] };
  if (parsed.productLines.length && !parsed.productLines.every((line) => fieldMatch(document.lines, normalizeSearchText(line), false) >= 2)) return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;
  const fullVariants = parsed.variants || aliasVariants(parsed.text);
  if (fullVariants.some((term) => document.names.includes(term))) { score += 130; reasons.push("exact-name"); }
  else if (fullVariants.some((term) => document.aliases.includes(term))) { score += 118; reasons.push("exact-alias"); }
  else if (fullVariants.some((term) => document.names.some((name) => name.startsWith(term)))) { score += 92; reasons.push("name-prefix"); }

  for (const [tokenIndex, token] of parsed.tokens.entries()) {
    const variants = parsed.tokenVariants?.[tokenIndex] || aliasVariants(token);
    let best = { value: 0, reason: "" };
    for (const variant of variants) {
      const candidates = [
        [fieldMatch(document.codes, variant, false), 34, "code"],
        [fieldMatch(document.names, variant, allowFuzzy), 27, "name"],
        [fieldMatch(document.aliases, variant, allowFuzzy), 24, "alias"],
        [fieldMatch(document.series, variant, false), 18, "series"],
        [fieldMatch(document.lines, variant, false), 16, "line"],
        [fieldMatch(document.tags, variant, false), 8, "tag"],
      ];
      for (const [quality, weight, reason] of candidates) {
        if (quality && quality * weight > best.value) best = { value: quality * weight, reason };
      }
    }
    if (!best.value) return { score: 0, reasons: [] };
    score += best.value;
    reasons.push(best.reason);
  }
  if (parsed.productLines.length) score += 25 * parsed.productLines.length;
  if (parsed.limited) score += 12;
  return { score, reasons: [...new Set(reasons)] };
}

export function searchDocuments(documents, rawQuery, options = {}) {
  const parsed = typeof rawQuery === "string" ? parseSearchQuery(rawQuery) : rawQuery;
  const rank = (allowFuzzy) => {
    const matches = [];
    for (const document of documents) {
      const match = scoreSearchDocument(document, parsed, { allowFuzzy });
      if (match.score > 0) matches.push({ document, item: document.item, ...match });
    }
    return matches;
  };
  let ranked = rank(false);
  if (!ranked.length && options.fuzzy !== false) ranked = rank(true);
  ranked.sort((a, b) => b.score - a.score || String(a.document.entityName).localeCompare(String(b.document.entityName)));
  const limit = Number.isFinite(options.limit) ? options.limit : ranked.length;
  return { parsed, results: ranked.slice(0, limit), total: ranked.length };
}

export function groupSearchResults(results, limit = 8) {
  const groups = new Map();
  for (const result of results) {
    const key = result.document.entityKey || result.document.id;
    const group = groups.get(key) || { key, name: result.document.entityName, score: result.score, count: 0, items: [] };
    group.count += 1;
    group.score = Math.max(group.score, result.score);
    group.items.push(result.item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, limit);
}

export function suggestSearches(documents, rawQuery, limit = 6) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];
  const suggestions = new Map();
  for (const document of documents) {
    for (const value of [...document.names, ...document.aliases, ...document.series, ...document.lines]) {
      const quality = fieldMatch([value], query);
      if (!quality) continue;
      const current = suggestions.get(value) || 0;
      suggestions.set(value, Math.max(current, quality));
    }
  }
  return [...suggestions].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, limit).map(([value]) => value);
}
