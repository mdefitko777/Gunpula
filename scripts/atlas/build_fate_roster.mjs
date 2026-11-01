// Hobby Atlas: builds data/atlas/fate-roster.json, "what belongs to each Fate work", which
// scripts/build_atlas_groups.mjs uses to sort Fate products into work / FGO-chapter groups.
//
// Sources (all fetched politely through lib/http.mjs: own UA, <= 1 request/s per host,
// responses cached under ATLAS_CACHE_DIR, never a bot-challenge workaround):
//   - Atlas Academy exports (api.atlasacademy.io/export/{JP,NA,CN,KR,TW}/basic_servant*.json):
//     every FGO servant with its class and its official JP / EN / CN / KR / TW name.
//   - Mooncell (fgo.wiki, MediaWiki API; robots.txt allows /api.php): servant pages for the
//     Chinese names, and every summoning banner page ({{卡池信息}}) with its JP name, JP start
//     date, linked story page and featured servants. A servant's FGO chapter is the story
//     chapter of the earliest chapter banner that featured it (FGO pickups feature the
//     servants who appear in that chapter); SERVANT_CHAPTER_OVERRIDES covers chapters that
//     never had a banner (Septem). Servants never on a chapter banner are event servants.
//   - Japanese Wikipedia article HTML (/wiki/ pages, allowed by robots.txt) for each work, to
//     check the hand-kept character names in fate_works.mjs (reported, never fatal).
//
// Run weekly or by hand (`npm run atlas:fate-roster`); the daily catalog refresh only reads
// the committed roster. `--offline` (or ATLAS_OFFLINE=1) rebuilds from the cache only.
import path from "node:path";
import { politeFetch, politeJson, requestSummary } from "./lib/http.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";
import { compactKey } from "./lib/textmatch.mjs";
import { FATE_WORKS, FGO_WORK, FGO_CHARACTERS, FGO_CHAPTER_TITLES, SERVANT_ORIGIN, SERVANT_CHAPTER_OVERRIDES, SERVANT_ALIASES } from "./fate_works.mjs";

if (process.argv.includes("--offline")) process.env.ATLAS_OFFLINE = "1";
const OUT = path.join(ATLAS_DATA, "fate-roster.json");
const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });

// FGO story chapters = Atlas Academy war ids. Banner images are the official in-game quest
// board banners served by Atlas Academy.
const CHAPTERS = [
  [100, "part1", lang("特异点F 燃烧污染都市 冬木", "특이점 F 염상오염도시 후유키", "Singularity F · Fuyuki", "特異点F 炎上汚染都市 冬木"), "questboard_cap100"],
  [101, "part1", lang("第一特异点 邪龙百年战争 奥尔良", "제1특이점 사룡백년전쟁 오를레앙", "Singularity I · Orleans", "第一特異点 邪竜百年戦争 オルレアン"), "questboard_cap101"],
  [102, "part1", lang("第二特异点 永续疯狂帝国 七丘之城", "제2특이점 영속광기제국 세프템", "Singularity II · Septem", "第二特異点 永続狂気帝国 セプテム"), "questboard_cap102"],
  [103, "part1", lang("第三特异点 封锁终局四海 俄刻阿诺斯", "제3특이점 봉쇄종국사해 오케아노스", "Singularity III · Okeanos", "第三特異点 封鎖終局四海 オケアノス"), "questboard_cap103"],
  [104, "part1", lang("第四特异点 死界魔雾都市 伦敦", "제4특이점 사계마무도시 런던", "Singularity IV · London", "第四特異点 死界魔霧都市 ロンドン"), "questboard_cap104"],
  [105, "part1", lang("第五特异点 北美神话大战 合众为一", "제5특이점 북미신화대전 E 플루리부스 우눔", "Singularity V · E Pluribus Unum", "第五特異点 北米神話大戦 イ・プルーリバス・ウナム"), "questboard_cap105"],
  [106, "part1", lang("第六特异点 神圣圆桌领域 卡美洛", "제6특이점 신성원탁영역 카멜롯", "Singularity VI · Camelot", "第六特異点 神聖円卓領域 キャメロット"), "questboard_cap106"],
  [107, "part1", lang("第七特异点 绝对魔兽战线 巴比伦尼亚", "제7특이점 절대마수전선 바빌로니아", "Singularity VII · Babylonia", "第七特異点 絶対魔獣戦線 バビロニア"), "questboard_cap107"],
  [108, "part1", lang("终局特异点 冠位时间神殿 所罗门", "종국특이점 관위시간신전 솔로몬", "Final Singularity · Solomon", "終局特異点 冠位時間神殿 ソロモン"), "questboard_cap108"],
  [201, "part1_5", lang("亚种特异点Ⅰ 恶性隔绝魔境 新宿", "아종특이점 I 악성격절마경 신주쿠", "Pseudo-Singularity I · Shinjuku", "亜種特異点Ⅰ 悪性隔絶魔境 新宿"), "questboard_cap201"],
  [202, "part1_5", lang("亚种特异点Ⅱ 传承地底世界 雅戈泰", "아종특이점 II 전승지저세계 아갈타", "Pseudo-Singularity II · Agartha", "亜種特異点Ⅱ 伝承地底世界 アガルタ"), "questboard_cap202"],
  [203, "part1_5", lang("亚种并行世界 尸山血河舞台 下总国", "아종병행세계 시산혈하무대 시모사국", "Pseudo-Singularity III · Shimousa", "亜種並行世界 屍山血河舞台 下総国"), "questboard_cap203"],
  [204, "part1_5", lang("亚种特异点Ⅳ 禁忌降临庭园 塞勒姆", "아종특이점 IV 금기강림정원 세일럼", "Pseudo-Singularity IV · Salem", "亜種特異点Ⅳ 禁忌降臨庭園 セイレム"), "questboard_cap204"],
  [301, "part2", lang("Lostbelt No.1 永久冻土帝国 阿纳斯塔西娅", "Lostbelt No.1 영구동토제국 아나스타샤", "Lostbelt No.1 · Anastasia", "Lostbelt No.1 永久凍土帝国 アナスタシア"), "questboard_cap301"],
  [302, "part2", lang("Lostbelt No.2 无间冰焰世纪 诸神黄昏", "Lostbelt No.2 무간빙염세기 괴터데머룽", "Lostbelt No.2 · Götterdämmerung", "Lostbelt No.2 無間氷焔世紀 ゲッテルデメルング"), "questboard_cap302"],
  [303, "part2", lang("Lostbelt No.3 人智统合真国 SIN", "Lostbelt No.3 인지통합진국 신", "Lostbelt No.3 · SIN", "Lostbelt No.3 人智統合真国 シン"), "questboard_cap304"],
  [304, "part2", lang("Lostbelt No.4 创世灭亡轮回 由伽·刹多罗", "Lostbelt No.4 창세멸망윤회 유가 크셰트라", "Lostbelt No.4 · Yuga Kshetra", "Lostbelt No.4 創世滅亡輪廻 ユガ・クシェートラ"), "questboard_cap305"],
  [305, "part2", lang("Lostbelt No.5 神代巨神海洋 亚特兰蒂斯", "Lostbelt No.5 신대거신해양 아틀란티스", "Lostbelt No.5 · Atlantis", "Lostbelt No.5 神代巨神海洋 アトランティス"), "questboard_cap307"],
  [306, "part2", lang("Lostbelt No.5 星间都市山脉 奥林波斯", "Lostbelt No.5 성간도시산맥 올림포스", "Lostbelt No.5 · Olympus", "Lostbelt No.5 星間都市山脈 オリュンポス"), "questboard_cap308"],
  [307, "part2", lang("地狱界曼荼罗 平安京", "지옥계 만다라 헤이안쿄", "Heian-kyō", "地獄界曼荼羅 平安京"), "questboard_cap309"],
  [308, "part2", lang("Lostbelt No.6 妖精圆桌领域 阿瓦隆·勒·菲", "Lostbelt No.6 요정원탁영역 아발론 르 페", "Lostbelt No.6 · Avalon le Fae", "Lostbelt No.6 妖精円卓領域 アヴァロン・ル・フェ"), "questboard_cap312"],
  [309, "part2", lang("非灵长生存圈 通古斯卡·圣域", "비영장생존권 퉁구스카 생추어리", "Tunguska Sanctuary", "非霊長生存圏 ツングースカ・サンクチュアリ"), "questboard_cap313"],
  [310, "part2", lang("死想显现界域 Traum", "사상현현계역 트라움", "Traum", "死想顕現界域 トラオム"), "questboard_cap315"],
  [311, "part2", lang("Lostbelt No.7 黄金树海纪行 纳维·米克特兰", "Lostbelt No.7 황금수해기행 나우이 믹틀란", "Lostbelt No.7 · Nahui Mictlan", "Lostbelt No.7 黄金樹海紀行 ナウイ・ミクトラン"), "questboard_cap317"],
  [402, "ordeal_call", lang("奏章Ⅰ 虚数罗针内界 平面之月", "주장 I 허수나침내계 페이퍼 문", "Ordeal Call I · Paper Moon", "奏章Ⅰ 虚数羅針内界 ペーパームーン"), "questboard_cap402"],
  [403, "ordeal_call", lang("奏章Ⅱ 不可逆废弃孔 伊底", "주장 II 불가역폐기공 이드", "Ordeal Call II · Id", "奏章Ⅱ 不可逆廃棄孔 イド"), "questboard_cap403"],
  [404, "ordeal_call", lang("奏章Ⅲ 新灵长后继战 原型肇始", "주장 III 신영장후계전 아키타입 인셉션", "Ordeal Call III · Archetype Inception", "奏章Ⅲ 新霊長後継戦 アーキタイプ・インセプション"), "questboard_cap405"],
  [405, "ordeal_call", lang("奏章Ⅳ 人类裁决法庭 三位一体·梅塔特洛尼俄斯", "주장 IV 인류재결법정 트리니티 메타트로니오스", "Ordeal Call IV · Trinity Metatronios", "奏章Ⅳ 人類裁決法廷 トリニティ・メタトロニオス"), "questboard_cap406"],
  [407, "ordeal_call", lang("终章", "종장", "Final Chapter", "終章"), "questboard_cap410"],
  [500, "after", lang("余日之始", "애프터타임의 시작", "Beginning of After Time", "アフタータイムのはじまり"), "questboard_cap500"],
  [501, "after", lang("命运三女神篇 乡愁永巡刻盘 过去的迦勒底", "운명의 세 여신 편 패스트 칼데아", "Past Chaldea", "運命の三女神編 郷愁永巡刻盤 パスト・カルデア"), "questboard_cap502"],
];
export const PART_LABELS = {
  part1: lang("第1部", "제1부", "Part 1", "第1部"),
  part1_5: lang("第1.5部", "제1.5부", "Part 1.5", "第1.5部"),
  part2: lang("第2部", "제2부", "Part 2", "第2部"),
  ordeal_call: lang("第2部 奏章", "제2부 주장", "Part 2 · Ordeal Call", "第2部 奏章"),
  after: lang("第2部之后", "제2부 이후", "After Part 2", "第2部以降"),
};

// How a Mooncell banner names its chapter: CN story page title (主关联页) or JP banner name.
const CHAPTER_KEYS = {
  100: ["冬木", "特异点F"],
  101: ["奥尔良", "オルレアン"],
  102: ["七丘之城", "セプテム"],
  103: ["第三特异点", "オケアノスピックアップ"],
  104: ["第四特异点", "ロンドンピックアップ"],
  105: ["第五特异点", "イ・プルーリバス・ウナム", "イプルーリバスウナム"],
  106: ["第六特异点", "キャメロットピックアップ", "キャメロット2ピックアップ"],
  107: ["第七特异点", "バビロニアピックアップ", "絶対魔獣戦線バビロニア", "绝对魔兽战线"],
  108: ["终局特异点", "ソロモンピックアップ"],
  201: ["亚种特异点Ⅰ", "新宿ピックアップ", "亜種特異点Ⅰ"],
  202: ["亚种特异点Ⅱ", "アガルタピックアップ"],
  203: ["亚种特异点Ⅲ", "下総国ピックアップ"],
  204: ["亚种特异点Ⅳ", "セイレムピックアップ"],
  301: ["Lostbelt No.1", "アナスタシアピックアップ召喚"],
  302: ["Lostbelt No.2", "ゲッテルデメルングピックアップ", "ナポレオンピックアップ"],
  303: ["Lostbelt No.3", "【シンピックアップ", "^シンピックアップ"],
  304: ["Lostbelt No.4", "ユガ・クシェートラピックアップ", "ユガ･クシェートラピックアップ"],
  305: ["Lostbelt No.5 神代巨神海洋", "アトランティスピックアップ"],
  306: ["Lostbelt No.5 星间都市山脉", "オリュンポスピックアップ"],
  307: ["地狱界曼荼罗", "平安京ピックアップ"],
  308: ["Lostbelt No.6", "アヴァロン・ル・フェピックアップ", "アヴァロン･ル･フェピックアップ"],
  309: ["通古斯卡", "ツングースカ"],
  310: ["死想显现界域", "トラオム"],
  311: ["Lostbelt No.7", "ナウイ・ミクトラン", "ナウイ･ミクトラン"],
  402: ["奏章Ⅰ", "ペーパームーン"],
  403: ["奏章Ⅱ", "イドピックアップ"],
  404: ["奏章Ⅲ", "アーキタイプ"],
  405: ["奏章Ⅳ", "メタトロニオス"],
  407: ["终章", "終章"],
  500: ["アフタータイム"],
  501: ["过去的迦勒底", "パスト・カルデア", "パスト･カルデア"],
};
// Banners that name a chapter but are not that chapter's own pickup.
const NOT_CHAPTER_BANNER = /復刻|复刻|クリア応援|应援|無料開放|免费开放|Improve|改善|聖杯戦線|圣杯战线|THE STAGE|劇場版|剧场版|TVアニメ|TV动画|コミック|漫画|Blu-ray|周年|Fes\.|福袋|ニューイヤー|バレンタイン|水着|夏|週替り|日替り|全騎/;
// A chapter banner lists the chapter's new servants (2-6); bigger lists are campaign reruns.
const MAX_CHAPTER_BANNER_SERVANTS = 8;
// Until the end of Part 1.5 (2017) chapter pickups also featured the launch servants who
// appear in that chapter. Later chapter banners only count for a servant's debut banner,
// so a rerun of an older event servant in a 2024 chapter pickup does not move it there.
const OPEN_CHAPTER_BANNERS_UNTIL = "2018-01-01";

const mooncell = "fgo.wiki";
async function mcQuery(params) {
  const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
  const res = await politeJson(`https://${mooncell}/api.php?${qs}`, { ttlHours: 24 * 6 });
  if (res.json.error) throw new Error(`Mooncell API error: ${res.json.error.code}`);
  return res.json;
}
async function mcEmbedded(template) {
  const out = [];
  let cont = {};
  for (let n = 0; n < 40; n++) {
    const j = await mcQuery({ list: "embeddedin", eititle: template, einamespace: "0", eilimit: "500", ...cont });
    out.push(...j.query.embeddedin.map((x) => x.title));
    if (!j.continue) return out;
    cont = j.continue;
  }
  throw new Error(`too many pages for ${template}`);
}
async function mcContents(titles) {
  const out = new Map();
  const sorted = [...titles].sort();
  for (let i = 0; i < sorted.length; i += 50) {
    const j = await mcQuery({ prop: "revisions", rvprop: "content", rvslots: "main", titles: sorted.slice(i, i + 50).join("|") });
    for (const p of j.query.pages) out.set(p.title, p.revisions?.[0]?.slots?.main?.content || "");
  }
  return out;
}
const field = (text, key) => {
  const m = text.match(new RegExp(`[|]${key}=([^\\n]*)`));
  return m ? m[1].replace(/<!--.*?-->/g, "").trim() : "";
};

async function atlas(region, file) {
  const res = await politeJson(`https://api.atlasacademy.io/export/${region}/${file}`, { ttlHours: 24 * 6 });
  return res.json;
}

const stripVariant = (name) => String(name || "").replace(/〔[^〕]*〕/g, "").trim();

async function main() {
  const previous = await readJson(OUT, null);
  const [jp, jpEn, cn, kr, tw] = await Promise.all([
    atlas("JP", "basic_servant.json"),
    atlas("JP", "basic_servant_lang_en.json"),
    atlas("CN", "basic_servant.json"),
    atlas("KR", "basic_servant.json"),
    atlas("TW", "basic_servant.json"),
  ]);
  const byId = (list) => new Map(list.map((s) => [s.id, s]));
  const enById = byId(jpEn);
  const cnById = byId(cn);
  const krById = byId(kr);
  const twById = byId(tw);
  const playable = jp.filter((s) => s.collectionNo > 0 && (s.type === "normal" || s.type === "heroine"));

  // Mooncell: servant pages (CN names) and banner pages (chapter evidence).
  const svtTitles = await mcEmbedded("Template:基础数值");
  const svtPages = await mcContents(svtTitles);
  const mcByNo = new Map();
  const noByMcTitle = new Map();
  for (const [title, text] of svtPages) {
    const no = Number(field(text, "序号"));
    if (!no) continue;
    const zh = [field(text, "中文名"), field(text, "中文名2"), field(text, "中文名3"), field(text, "国服名"), field(text, "中文战斗名"), title].filter(Boolean);
    if (!mcByNo.has(no)) mcByNo.set(no, { title, zh: [] });
    mcByNo.get(no).zh.push(...zh);
    noByMcTitle.set(title, no);
  }
  const gachaTitles = await mcEmbedded("Template:卡池信息");
  const gachaPages = await mcContents(gachaTitles);
  const banners = [];
  for (const [title, text] of gachaPages) {
    const date = field(text, "开始时间jp").slice(0, 10);
    const svts = field(text, "推荐召唤从者").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!date || !svts.length) continue;
    banners.push({ title, jp: field(text, "名称jp"), main: field(text, "主关联页"), date, svts });
  }
  banners.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const keyHit = (key, text) => (key.startsWith("^") ? text.startsWith(key.slice(1)) : text.includes(key));
  const chapterOfBanner = (b) => {
    if (b.svts.length > MAX_CHAPTER_BANNER_SERVANTS) return null;
    if (NOT_CHAPTER_BANNER.test(b.jp) || NOT_CHAPTER_BANNER.test(b.main)) return null;
    for (const [war, keys] of Object.entries(CHAPTER_KEYS)) {
      if (keys.some((k) => keyHit(k, b.main) || keyHit(k, b.jp))) return Number(war);
    }
    return null;
  };
  const noOf = (name) => noByMcTitle.get(name) ?? noByMcTitle.get(name.replace(/\s+/g, ""));
  const unknownNames = new Set();
  const firstBanner = new Map(); // servant no -> first banner (any kind) that featured it
  for (const b of banners) {
    if (b.svts.length > 12) continue;
    for (const name of b.svts) {
      const no = noOf(name);
      if (!no) unknownNames.add(name);
      else if (!firstBanner.has(no)) firstBanner.set(no, b);
    }
  }
  const firstChapter = new Map();
  for (const b of banners) {
    const war = chapterOfBanner(b);
    if (!war) continue;
    for (const name of b.svts) {
      const no = noOf(name);
      if (!no || firstChapter.has(no)) continue;
      if (b.date >= OPEN_CHAPTER_BANNERS_UNTIL && firstBanner.get(no) !== b) continue;
      firstChapter.set(no, { war, basis: `${b.date} ${b.jp || b.title}` });
    }
  }

  const originByName = new Map();
  for (const [work, names] of Object.entries(SERVANT_ORIGIN)) for (const n of names) originByName.set(n, work);

  const servants = playable
    .sort((a, b) => a.collectionNo - b.collectionNo)
    .map((s) => {
      const en = enById.get(s.id);
      const zh = [...new Set([cnById.get(s.id)?.name, ...(mcByNo.get(s.collectionNo)?.zh || [])].filter(Boolean))];
      const override = SERVANT_CHAPTER_OVERRIDES[`${s.name}|${s.className}`];
      const first = firstChapter.get(s.collectionNo);
      const chapter = override || (first ? `fgo_${first.war}` : null);
      return {
        no: s.collectionNo,
        id: s.id,
        class: s.className,
        rarity: s.rarity,
        names: {
          ja: s.name,
          ja_original: s.originalName !== s.name ? s.originalName : undefined,
          en: en?.name || "",
          en_original: en?.originalName && en.originalName !== en.name ? en.originalName : undefined,
          zh,
          zh_tw: twById.get(s.id)?.name || undefined,
          ko: krById.get(s.id)?.name || undefined,
        },
        base: stripVariant(s.name),
        chapter,
        chapter_basis: override ? "manual (chapter had no pickup banner)" : first ? `Mooncell banner ${first.basis}` : "no chapter banner (event / limited)",
        // Exact Atlas name: alternate versions (〔オルタ〕, swimsuits, …) are FGO's own unless listed.
        origin_work: originByName.get(s.name) || "fgo",
        aliases: SERVANT_ALIASES[`${s.name}|${s.className}`] || undefined,
      };
    });
  const known = new Set(playable.map((s) => `${s.name}|${s.className}`));
  const staleOverrides = [...Object.keys(SERVANT_CHAPTER_OVERRIDES), ...Object.keys(SERVANT_ALIASES)].filter((k) => !known.has(k));
  if (staleOverrides.length) console.warn(`chapter overrides / aliases that match no servant: ${staleOverrides.join(", ")}`);
  const knownNames = new Set(playable.map((s) => s.name));
  const staleOrigins = Object.values(SERVANT_ORIGIN).flat().filter((n) => !knownNames.has(n));
  if (staleOrigins.length) console.warn(`SERVANT_ORIGIN names that match no servant: ${staleOrigins.join(", ")}`);

  // Check hand-kept character names against each work's Japanese Wikipedia article.
  const verification = {};
  for (const work of FATE_WORKS) {
    if (!work.wiki_ja || !work.chars.length) continue;
    try {
      const res = await politeFetch(`https://ja.wikipedia.org/wiki/${encodeURIComponent(work.wiki_ja).replace(/%2F/g, "/")}`, { ttlHours: 24 * 30, accept: "text/html" });
      const page = compactKey(res.body.replace(/<[^>]+>/g, " "));
      const missing = work.chars.map((c) => c[0]).filter((ja) => !page.includes(compactKey(ja)));
      verification[work.id] = { source: `https://ja.wikipedia.org/wiki/${work.wiki_ja}`, checked: work.chars.length, missing };
    } catch (error) {
      verification[work.id] = { source: `https://ja.wikipedia.org/wiki/${work.wiki_ja}`, error: String(error.message || error) };
    }
  }

  const chapters = CHAPTERS.map(([war, part, labels, banner]) => ({
    id: `fgo_${war}`,
    war_id: war,
    part,
    labels,
    image: `https://static.atlasacademy.io/JP/Banner/${banner}.png`,
    title_patterns: FGO_CHAPTER_TITLES[`fgo_${war}`] || [],
  }));

  const out = {
    updated_at: today(),
    sources: [
      { name: "Atlas Academy export (servant names JP/EN/CN/KR/TW, classes)", url: "https://api.atlasacademy.io/export/" },
      { name: "Mooncell FGO wiki (Chinese names, summoning banners → story chapter)", url: "https://fgo.wiki/" },
      { name: "Japanese Wikipedia (character name check per work)", url: "https://ja.wikipedia.org/" },
      { name: "Hand-kept work list, title patterns and non-servant characters", url: "scripts/atlas/fate_works.mjs" },
    ],
    counts: {
      servants: servants.length,
      servants_with_chapter: servants.filter((s) => s.chapter).length,
      banners: banners.length,
      chapter_banners: banners.filter(chapterOfBanner).length,
    },
    part_labels: PART_LABELS,
    chapters,
    fgo: {
      patterns: FGO_WORK.patterns,
      aniplex: FGO_WORK.aniplex,
      tags: FGO_WORK.tags,
      wiki_en: FGO_WORK.wiki_en,
      characters: FGO_CHARACTERS.map(([ja, en, zh, ko, chapter, ...aliases]) => ({ ja, en, zh, ko, chapter, aliases })),
    },
    works: FATE_WORKS.map((w) => ({
      id: w.id,
      labels: w.labels,
      subtitle: w.subtitle,
      patterns: w.patterns,
      aniplex: w.aniplex || [],
      tags: w.tags || [],
      wiki_ja: w.wiki_ja,
      wiki_en: w.wiki_en,
      characters: [
        ...w.chars.map(([ja, en, zh, ko, ...aliases]) => ({ ja, en, zh, ko, aliases })),
        ...(w.weak_chars || []).map(([ja, en, zh, ko, ...aliases]) => ({ ja, en, zh, ko, aliases, weak: true })),
      ],
    })),
    servants,
    verification,
    unresolved_banner_names: [...unknownNames].sort(),
  };
  if (previous && previous.servants?.length > servants.length + 5) {
    throw new Error(`servant count fell from ${previous.servants.length} to ${servants.length}; keeping the old roster`);
  }
  const res = await writeCompactJson(OUT, out);
  console.log(`fate roster: ${servants.length} servants (${out.counts.servants_with_chapter} with a chapter), ${out.counts.chapter_banners}/${banners.length} chapter banners -> ${res.written ? "written" : "unchanged"}`);
  for (const [id, v] of Object.entries(verification)) if (v.missing?.length || v.error) console.log(`  wiki check ${id}: ${v.error || `missing ${v.missing.join(", ")}`}`);
  if (unknownNames.size) console.log(`  banner names without a Mooncell servant page: ${[...unknownNames].slice(0, 20).join(", ")}`);
  console.log(JSON.stringify(requestSummary()));
}

await main();
