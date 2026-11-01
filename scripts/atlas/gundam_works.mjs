// Human-maintained Gundam work (作品) table for Hobby Atlas.
//
// id        official gundam-official.com series slug where one exists, otherwise our own slug
// timeline  one of TIMELINES[].id
// gget      soshage/GGET series ids folded into this work (first = primary, names come from it)
// manual    WEB取説 (manual.bandai-hobby.net) titles[] ids
// legacy    old Gunpula kits.json series.key values (last-resort kit -> work fallback)
// wiki      Gundam Wiki infobox "series" values: exact strings or RegExp (first match wins,
//           so more specific works are listed before broader ones in WIKI_ORDER below)
// names     only when GGET has no series for the work (or to override GGET's wording)
//
// Every GGET series that has units but is not folded into a work below becomes an
// automatic work with GGET's names and the timeline from AUTO_TIMELINE. Its id is a slug of
// the English title ("Mobile Suit Gundam: Gihren's Greed" -> "gihrens-greed"); the GGET series
// id stays available as gget_series_id. "gget-<id>" is used only when no slug can be made.

export const TIMELINES = [
  { id: "UC", names: { ja: "宇宙世紀", en: "Universal Century", ko: "우주세기", zh: "宇宙世纪" }, eras: ["Universal Century", "Universal Century (Thunderbolt)", "Universal Century (thunderbolt)", "Universal Century (For the Barrel)"] },
  { id: "GQ", names: { ja: "宇宙世紀 (GQuuuuuuX)", en: "Universal Century (GQuuuuuuX)", ko: "우주세기 (GQuuuuuuX)", zh: "宇宙世纪 (GQuuuuuuX)" }, eras: ["Universal Century (GQ)"] },
  { id: "FC", names: { ja: "未来世紀", en: "Future Century", ko: "미래세기", zh: "未来世纪" }, eras: ["Future Century"] },
  { id: "AC", names: { ja: "アフターコロニー", en: "After Colony", ko: "애프터 콜로니", zh: "后殖民纪元" }, eras: ["After Colony"] },
  { id: "AW", names: { ja: "アフターウォー", en: "After War", ko: "애프터 워", zh: "战后纪元" }, eras: ["After War"] },
  { id: "CC", names: { ja: "正暦", en: "Correct Century", ko: "정력", zh: "正历" }, eras: ["Correct Century"] },
  { id: "CE", names: { ja: "コズミック・イラ", en: "Cosmic Era", ko: "코즈믹 에라", zh: "宇宙纪元" }, eras: ["Cosmic Era"] },
  { id: "AD", names: { ja: "西暦", en: "Anno Domini", ko: "서력", zh: "公元" }, eras: ["Anno Domini"] },
  { id: "AG", names: { ja: "アドバンスド・ジェネレーション", en: "Advanced Generation", ko: "어드밴스드 제너레이션", zh: "AG纪元" }, eras: ["Advanced Generation"] },
  { id: "RC", names: { ja: "リギルド・センチュリー", en: "Regild Century", ko: "리길드 센추리", zh: "再生世纪" }, eras: ["Regild Century"] },
  { id: "PD", names: { ja: "P.D.(厄祭戦後)", en: "Post Disaster", ko: "P.D.(재해 후)", zh: "灾后纪元" }, eras: ["Post Disaster"] },
  { id: "AS", names: { ja: "アド・ステラ", en: "Ad Stella", ko: "애드 스텔라", zh: "Ad Stella" }, eras: ["Ad Stella"] },
  { id: "BUILD", names: { ja: "ビルドシリーズ", en: "Build series", ko: "빌드 시리즈", zh: "创战系列" }, eras: ["Build Fighters", "Gunpla Builders", "Gundam Breaker", "Plamo Kyo-Shiro"] },
  { id: "SD", names: { ja: "SDガンダム", en: "SD Gundam", ko: "SD 건담", zh: "SD高达" }, eras: ["Super Deformed"] },
  { id: "OTHER", names: { ja: "その他", en: "Other", ko: "기타", zh: "其他" }, eras: [] },
];

export const WORKS = [
  // ---- Universal Century ----
  { id: "mobile-suit-gundam", timeline: "UC", gget: [10], manual: [19], legacy: ["uc_first"], wiki: ["Mobile Suit Gundam", "Mobile Suit Gundam I", "Mobile Suit Gundam II: Soldiers of Sorrow", "Mobile Suit Gundam III: Encounters in Space", "Mobile Suit Gundam: Encounters in Space", "Mobile Suit Gundam 0079", "Mobile Suit Gundam (Novel)"] },
  { id: "origin", timeline: "UC", gget: [30, 50], manual: [12], legacy: ["origin"], wiki: [/^Mobile Suit Gundam:? The Origin(?!.*Cucuruz)/i] },
  { id: "cucuruz-doans-island", timeline: "UC", manual: [13], names: { ja: "機動戦士ガンダム ククルス・ドアンの島", en: "Mobile Suit Gundam: Cucuruz Doan's Island", ko: "기동전사 건담 쿠쿠루스 도안의 섬", zh: "机动战士高达 库克罗斯·德安之岛" }, wiki: [/Cucuruz Doan's Island/i] },
  { id: "msv", timeline: "UC", gget: [70, 80, 830, 980, 990, 1140, 1150, 1330], manual: [39], legacy: ["msv"], wiki: ["Mobile Suit Variation", "MS-X", "MSV-R", "M-MSV", "UC-MSV", "Zeta Gundam Mobile Suit Variations", "Char's Counterattack Mobile Suit Variations", /^MSV-R/, /^Mobile Suit Gundam MSV-R/] },
  { id: "ms-igloo", timeline: "UC", gget: [90, 110, 120], manual: [32], wiki: [/^Mobile Suit Gundam:? MS IGLOO/i] },
  { id: "08th-ms-team", timeline: "UC", gget: [130], manual: [33], legacy: ["08ms"], wiki: [/^Mobile Suit Gundam: The 08th MS Team/] },
  { id: "0080-war-in-the-pocket", timeline: "UC", gget: [170], manual: [21], legacy: ["0080"], wiki: [/^Mobile Suit Gundam 0080/] },
  { id: "blue-destiny", timeline: "UC", gget: [220, 230], manual: [36], wiki: [/The Blue Destiny/i] },
  { id: "thunderbolt", timeline: "UC", gget: [310, 320, 330], manual: [14], legacy: ["thunderbolt"], wiki: [/^Mobile Suit Gundam Thunderbolt/i] },
  { id: "0083", timeline: "UC", gget: [600, 630], manual: [31], legacy: ["0083"], wiki: [/^Mobile Suit Gundam 0083/] },
  { id: "z", timeline: "UC", gget: [800, 810, 820], manual: [11], legacy: ["zeta"], wiki: [/^Mobile Suit Zeta Gundam/, /^Mobile Suit Z Gundam/] },
  { id: "aoz", timeline: "UC", gget: [700], manual: [37], legacy: ["aoz"], wiki: [/^Advance of Zeta/] },
  { id: "sentinel", timeline: "UC", gget: [850], manual: [4], legacy: ["sentinel"], wiki: [/^Gundam Sentinel/] },
  { id: "zz", timeline: "UC", gget: [950], manual: [25], legacy: ["zz"], wiki: [/^Mobile Suit Gundam ZZ/] },
  { id: "chars-counterattack", timeline: "UC", gget: [1100], manual: [16], legacy: ["cca"], wiki: [/^Mobile Suit Gundam: Char's Counterattack/] },
  { id: "unicorn", timeline: "UC", gget: [1250, 1390], manual: [26], legacy: ["unicorn"], wiki: [/^Mobile Suit Gundam Unicorn/] },
  { id: "narrative", timeline: "UC", gget: [1440], manual: [15], legacy: ["narrative"], wiki: [/^Mobile Suit Gundam Narrative/] },
  { id: "twilight-axis", timeline: "UC", manual: [24], names: { ja: "機動戦士ガンダム Twilight AXIS", en: "Mobile Suit Gundam Twilight Axis", ko: "기동전사 건담 Twilight AXIS", zh: "机动战士高达 Twilight AXIS" }, wiki: [/Twilight Axis/i] },
  { id: "hathaway", timeline: "UC", gget: [1500], manual: [17], legacy: ["hathaway"], wiki: [/Hathaway/] },
  { id: "f90", timeline: "UC", gget: [1550, 1540], wiki: [/^Mobile Suit Gundam F90/] },
  { id: "f91", timeline: "UC", gget: [1620, 1570, 1590, 1630], manual: [22], legacy: ["f91"], wiki: [/^Mobile Suit Gundam F91/, /Silhouette Formula 91/, "Gundam F91 Mobile Suit Variations"] },
  { id: "crossbone", timeline: "UC", gget: [1660], manual: [28], legacy: ["crossbone"], wiki: [/^Mobile Suit Crossbone Gundam/] },
  { id: "v", timeline: "UC", gget: [1750], manual: [10], legacy: ["victory"], wiki: [/^Mobile Suit Victory Gundam/, "Victory Gundam Mobile Suit Variations"] },
  { id: "moon", timeline: "UC", manual: [40], legacy: ["moon"], names: { ja: "機動戦士MOONガンダム", en: "Mobile Suit Moon Gundam", ko: "기동전사 MOON 건담", zh: "机动战士MOON高达" }, wiki: [/^Mobile Suit Moon Gundam/] },
  { id: "requiem-for-vengeance", timeline: "UC", manual: [133], names: { ja: "機動戦士ガンダム 復讐のレクイエム", en: "Mobile Suit Gundam: Requiem for Vengeance", ko: "기동전사 건담 복수의 레퀴엠", zh: "机动战士高达 复仇的安魂曲" }, wiki: [/Requiem for Vengeance/] },
  { id: "gquuuuuux", timeline: "GQ", gget: [550], manual: [166], legacy: ["gqux"], wiki: [/GQuuuuuuX/] },
  // ---- Alternative universes ----
  { id: "g", timeline: "FC", gget: [2000], manual: [29], legacy: ["g"], wiki: [/^Mobile Fighter G Gundam/, "G Gundam", /^Super-Class! Mobile Fighter G Gundam/] },
  { id: "wing-endless-waltz", timeline: "AC", gget: [2190, 2110], wiki: [/Endless Waltz/] },
  { id: "wing", timeline: "AC", gget: [2100, 2120, 2170], manual: [30], legacy: ["w"], wiki: [/^(New )?Mobile (Suit|Report) Gundam Wing/] },
  { id: "x", timeline: "AW", gget: [2300], manual: [35], legacy: ["x"], wiki: [/^After War Gundam X/] },
  { id: "turn-a", timeline: "CC", gget: [2400], manual: [38], legacy: ["turn_a"], wiki: [/^∀ Gundam/, /^Turn A Gundam/] },
  { id: "seed-astray", timeline: "CE", gget: [3050, 3060, 3070, 3080, 3390, 3420], wiki: [/Astray/i] },
  { id: "seed-stargazer", timeline: "CE", gget: [3360], wiki: [/STARGAZER/i] },
  { id: "seed-freedom-zero", timeline: "CE", manual: [364], names: { ja: "機動戦士ガンダムSEED FREEDOM ZERO", en: "Mobile Suit Gundam SEED FREEDOM ZERO", ko: "기동전사 건담 SEED FREEDOM ZERO", zh: "机动战士高达SEED FREEDOM ZERO" }, wiki: [/SEED Freedom Zero/i] },
  { id: "seed-freedom", timeline: "CE", gget: [3500], manual: [67], wiki: [/^Mobile Suit Gundam SEED Freedom/i] },
  { id: "seed-destiny", timeline: "CE", gget: [3300, 3330], manual: [23], wiki: [/^Mobile Suit Gundam SEED Destiny/i] },
  { id: "seed", timeline: "CE", gget: [3000, 3100, 3040], manual: [1], legacy: ["seed"], wiki: [/^Mobile Suit Gundam SEED/i] },
  { id: "00", timeline: "AD", gget: [3700], manual: [20], legacy: ["double_o"], wiki: ["Mobile Suit Gundam 00", /^Mobile Suit Gundam 00 (The Movie|\(Manga\)|Second Season|Season)/] },
  { id: "age", timeline: "AG", gget: [4000, 4010, 4080, 4090], manual: [9], legacy: ["age"], wiki: [/^Mobile Suit Gundam AGE/] },
  { id: "reconguista-in-g", timeline: "RC", gget: [4200], manual: [3], legacy: ["g_reco"], wiki: [/Reconguista in G/] },
  { id: "orphans-gekko", timeline: "PD", gget: [4310], wiki: [/IRON-BLOODED ORPHANS Gekko/i] },
  { id: "orphans-urdr-hunt", timeline: "PD", gget: [4330], wiki: [/Urdr-Hunt/i] },
  { id: "orphans", timeline: "PD", gget: [4300, 4340], manual: [18], legacy: ["ibo"], wiki: [/^Mobile Suit Gundam IRON-BLOODED ORPHANS/i] },
  { id: "witch-from-mercury", timeline: "AS", gget: [5010, 5000], manual: [27], legacy: ["witch"], wiki: [/Witch from Mercury/i] },
  // ---- Build series ----
  { id: "gunpla-builders", timeline: "BUILD", gget: [6000], wiki: [/^Model Suit Gunpla Builders/] },
  { id: "build-fighters-try", timeline: "BUILD", names: { ja: "ガンダムビルドファイターズトライ", en: "Gundam Build Fighters Try", ko: "건담 빌드 파이터즈 트라이", zh: "高达创战者TRY" }, wiki: [/^Gundam Build Fighters (Try|Honoo)/] },
  { id: "build-fighters", timeline: "BUILD", gget: [6040], manual: [7], legacy: ["build"], wiki: [/^Gundam Build Fighters/] },
  { id: "build-divers-rerise", timeline: "BUILD", manual: [6], names: { ja: "ガンダムビルドダイバーズRe:RISE", en: "Gundam Build Divers Re:RISE", ko: "건담 빌드 다이버즈 Re:RISE", zh: "高达创形者Re:RISE" }, wiki: [/Re:RISE/i, "Gundam Build Diver Rize"] },
  { id: "build-divers", timeline: "BUILD", manual: [5], names: { ja: "ガンダムビルドダイバーズ", en: "Gundam Build Divers", ko: "건담 빌드 다이버즈", zh: "高达创形者" }, wiki: [/^Gundam Build Divers/] },
  { id: "build-metaverse", timeline: "BUILD", manual: [8], names: { ja: "ガンダムビルドメタバース", en: "Gundam Build Metaverse", ko: "건담 빌드 메타버스", zh: "高达创坏者 元宇宙" }, wiki: [/^Gundam Build Metaverse/] },
  { id: "breaker-battlogue", timeline: "BUILD", manual: [2], names: { ja: "ガンダムブレイカー バトローグ", en: "Gundam Breaker Battlogue", ko: "건담 브레이커 배틀로그", zh: "高达破坏者 对战风云录" }, wiki: [/^Gundam Breaker Battlogue/] },
  { id: "plamo-kyoshiro", timeline: "BUILD", gget: [6500], wiki: [/^Plamo-?Kyoshiro/] },
  // ---- SD ----
  { id: "sd-gundam-gaiden", timeline: "SD", gget: [7050, 7051, 7052, 7053, 7300], wiki: [/^SD Gundam (Gaiden|Side Story)/] },
  { id: "sd-sengokuden", timeline: "SD", gget: [7001], wiki: [/Sengokuden/] },
  // BB戦士 三国伝 (2007-2011 and the later 群雄割拠 sets): generals glued to MS names.
  { id: "sd-sangokuden", timeline: "SD", names: { ja: "SDガンダム三国伝 Brave Battle Warriors", en: "SD Gundam Sangokuden Brave Battle Warriors", ko: "SD건담 삼국전 Brave Battle Warriors", zh: "SD高达三国传 Brave Battle Warriors" }, wiki: [/Sangokuden/i] },
  { id: "sd-gundam-world-soketsuden", timeline: "SD", gget: [7250], legacy: ["sangoku"], wiki: [/Sangoku Soketsuden/i] },
  { id: "sd-gundam-world-heroes", timeline: "SD", names: { ja: "SDガンダムワールド ヒーローズ", en: "SD Gundam World Heroes", ko: "SD건담 월드 히어로즈", zh: "SD高达世界 群英集" }, wiki: [/SD Gundam World Heroes/i] },
];

// Timeline for GGET series that become automatic works.
export const AUTO_TIMELINE = {
  210: "UC", 240: "UC", 260: "UC", 290: "UC", 440: "UC", 670: "UC", 680: "UC", 690: "UC", 840: "UC", 1000: "UC", 1010: "UC", 5100: "UC",
  7630: "UC", 7640: "UC", 7710: "UC",
  3750: "AD", 3760: "AD", 3780: "AD", 3790: "AD", 3821: "AD",
  7090: "SD", 7280: "SD", 7600: "SD",
};

// Wiki era -> timeline id.
export function eraTimeline(era) {
  for (const t of TIMELINES) if (t.eras.includes(era)) return t.id;
  return null;
}

/** Build the full work list: curated works + automatic works for remaining GGET series. */
export function buildWorks(ggetSeries) {
  const seriesById = new Map((ggetSeries || []).map((s) => [s.id, s]));
  const folded = new Set(WORKS.flatMap((w) => w.gget || []));
  const timelineOrder = new Map(TIMELINES.map((t, i) => [t.id, i]));
  const works = WORKS.map((w) => {
    const primary = w.gget?.length ? seriesById.get(w.gget[0]) : null;
    return {
      ...w,
      names: { ...(primary?.names || {}), ...(w.names || {}) },
      gget: w.gget || [],
      manual: w.manual || [],
      legacy: w.legacy || [],
      wiki: w.wiki || [],
      auto: false,
    };
  });
  const taken = new Set(works.map((w) => w.id));
  const slugOf = (s) => {
    const en = String(s.names?.en || "")
      .normalize("NFKC")
      .replace(/^Mobile Suit Gundam\b:?\s*(?=\S)/i, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return en && !taken.has(en) ? en : `gget-${s.id}`;
  };
  for (const s of ggetSeries || []) {
    if (folded.has(s.id) || !s.names?.ja || !(s.units > 0)) continue;
    const id = slugOf(s);
    taken.add(id);
    works.push({
      id,
      timeline: AUTO_TIMELINE[s.id] || "OTHER",
      gget: [s.id],
      manual: [],
      legacy: [],
      wiki: s.names.en ? [s.names.en] : [],
      names: s.names,
      auto: true,
    });
  }
  // Stable order: timeline order, then curated position, then GGET sort.
  const curatedIndex = new Map(WORKS.map((w, i) => [w.id, i]));
  works.sort((a, b) => {
    const t = timelineOrder.get(a.timeline) - timelineOrder.get(b.timeline);
    if (t) return t;
    const ia = curatedIndex.has(a.id) ? curatedIndex.get(a.id) : 1000 + (seriesById.get(a.gget[0])?.sort || 0) / 1e5;
    const ib = curatedIndex.has(b.id) ? curatedIndex.get(b.id) : 1000 + (seriesById.get(b.gget[0])?.sort || 0) / 1e5;
    return ia - ib;
  });
  works.forEach((w, i) => (w.order = i + 1));
  return works;
}

/** Matcher for Gundam Wiki "series" strings -> work id. */
export function wikiSeriesMatcher(works) {
  const exact = new Map();
  const regexes = [];
  for (const w of works) {
    for (const a of w.wiki) {
      if (a instanceof RegExp) regexes.push([a, w.id]);
      else if (!exact.has(a.toLowerCase())) exact.set(a.toLowerCase(), w.id);
    }
  }
  return (series) => {
    const s = String(series || "").trim();
    if (!s) return null;
    const hit = exact.get(s.toLowerCase());
    if (hit) return hit;
    for (const [re, id] of regexes) if (re.test(s)) return id;
    return null;
  };
}
