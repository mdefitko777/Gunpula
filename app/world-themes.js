const copy = (zh, ko, en, ja) => ({ zh, ko, en, ja });

export const WORLD_THEME_CONFIG = {
  gundam: {
    title: copy("高达宇宙档案", "건담 유니버스", "Gundam Universe", "ガンダム宇宙"),
    lead: copy("沿着纪年与作品寻找机体，再进入对应商品线。", "연표와 작품을 따라 기체와 상품을 찾습니다.", "Follow eras and works from mobile suits to their products.", "年表と作品から機体、商品へ辿ります。"),
    mode: "timeline",
    guideTab: "gundam",
    eyebrow: copy("宇宙航路", "우주 항로", "Universe route", "宇宙航路"),
    nav: [
      ["home", copy("舰桥", "브리지", "Bridge", "ブリッジ"), "bridge"],
      ["updates", copy("通讯", "통신", "Signal", "通信"), "signal"],
      ["guide", copy("机体", "기체", "Suits", "機体"), "mecha"],
      ["collection", copy("整备", "정비", "Hangar", "整備"), "hangar"],
      ["me", copy("驾驶员", "파일럿", "Pilot", "パイロット"), "pilot"],
    ],
  },
  armored_core: {
    title: copy("Armored Core 机库", "Armored Core 격납고", "Armored Core Hangar", "Armored Core ハンガー"),
    lead: copy("从游戏世代、机体框架与产品线进入你的整备库。", "게임 세대, 프레임, 제품 라인으로 격납고를 탐색합니다.", "Enter the hangar by game era, frame, and product line.", "ゲーム世代、フレーム、商品ラインから格納庫へ。"),
    mode: "hangar",
    guideTab: "armored_core",
    eyebrow: copy("RAVEN // GARAGE", "RAVEN // GARAGE", "RAVEN // GARAGE", "RAVEN // GARAGE"),
    nav: [
      ["home", copy("基地", "기지", "Base", "基地"), "base"],
      ["updates", copy("任务", "미션", "Missions", "ミッション"), "mission"],
      ["guide", copy("机库", "격납고", "Garage", "ガレージ"), "garage"],
      ["collection", copy("仓储", "창고", "Storage", "倉庫"), "storage"],
      ["me", copy("渡鸦", "레이븐", "Raven", "レイヴン"), "raven"],
    ],
  },
  pokemon: {
    title: copy("宝可梦世代旅志", "포켓몬 세대 여행기", "Pokemon Field Journal", "ポケモン世代旅誌"),
    lead: copy("从地区与世代出发，收集拼装、扭蛋、玩偶和周边。", "지방과 세대에서 출발해 프라, 가샤폰, 인형을 모읍니다.", "Travel by region and generation through kits, capsules, plush, and goods.", "地方と世代からプラモ、ガシャポン、ぬいぐるみを集めます。"),
    mode: "regions",
    guideTab: "pokemon",
    eyebrow: copy("训练家手册", "트레이너 노트", "Trainer notes", "トレーナーノート"),
    nav: [
      ["home", copy("营地", "캠프", "Camp", "キャンプ"), "camp"],
      ["updates", copy("消息", "소식", "News", "ニュース"), "news"],
      ["guide", copy("图鉴", "도감", "Dex", "ずかん"), "dex"],
      ["collection", copy("背包", "가방", "Bag", "バッグ"), "bag"],
      ["me", copy("训练家", "트레이너", "Trainer", "トレーナー"), "trainer"],
    ],
  },
  beyblade: {
    title: copy("Beyblade X 竞技场", "Beyblade X 아레나", "Beyblade X Arena", "ベイブレードX アリーナ"),
    lead: copy("用 Blade、Ratchet、Bit 拆解组合，并联动整机商品。", "Blade, Ratchet, Bit 조합과 제품을 함께 봅니다.", "Build with Blade, Ratchet, and Bit, linked back to complete products.", "ブレード、ラチェット、ビットから構成と商品を辿ります。"),
    mode: "arena",
    guideTab: "bbx",
    eyebrow: copy("X-TREME DECK", "X-TREME DECK", "X-TREME DECK", "X-TREME DECK"),
    nav: [
      ["home", copy("竞技场", "아레나", "Arena", "アリーナ"), "arena"],
      ["updates", copy("赛报", "매치", "Matches", "マッチ"), "match"],
      ["guide", copy("组合", "콤보", "Combos", "コンボ"), "combo"],
      ["collection", copy("装备", "장비", "Gear", "ギア"), "gear"],
      ["me", copy("玩家", "플레이어", "Player", "ブレーダー"), "blader"],
    ],
  },
  fate: {
    title: copy("Fate / FGO 灵子记录", "Fate / FGO 영자 기록", "Fate / FGO Chronicle", "Fate / FGO 霊子記録"),
    lead: copy("穿过作品书库与 FGO 章节长卷，连接角色和周边。", "작품 서고와 FGO 장의 연표에서 캐릭터 굿즈로 이어집니다.", "Move through the work archive and FGO chapter chronicle into character goods.", "作品書庫とFGO章の長巻からキャラクター商品へ。"),
    mode: "chronicle",
    guideTab: "fate",
    eyebrow: copy("CHALDEA ARCHIVE", "CHALDEA ARCHIVE", "CHALDEA ARCHIVE", "CHALDEA ARCHIVE"),
    nav: [
      ["home", copy("迦勒底", "칼데아", "Chaldea", "カルデア"), "chaldea"],
      ["updates", copy("观测", "관측", "Observe", "観測"), "observe"],
      ["guide", copy("灵基", "영기", "Spirit", "霊基"), "spirit"],
      ["collection", copy("保管库", "보관고", "Vault", "保管庫"), "vault"],
      ["me", copy("御主", "마스터", "Master", "マスター"), "master"],
    ],
  },
};

export const WORLD_SEARCH_PLACEHOLDERS = {
  gundam: copy("搜索机体 / 作品 / HG·MG·MB", "기체 / 작품 / HG·MG·MB 검색", "Search suit / work / HG·MG·MB", "機体 / 作品 / HG·MG·MB 検索"),
  armored_core: copy("搜索机体 / 游戏 / V.I.·30MM", "기체 / 게임 / V.I.·30MM 검색", "Search AC / game / V.I.·30MM", "機体 / ゲーム / V.I.·30MM 検索"),
  pokemon: copy("搜索编号 / 宝可梦 / 拼装·毛绒", "번호 / 포켓몬 / 프라·인형 검색", "Search No. / Pokemon / kit·plush", "番号 / ポケモン / プラモ·ぬいぐるみ"),
  fate: copy("搜索角色 / 作品 / FGO 章节", "캐릭터 / 작품 / FGO 장 검색", "Search character / work / FGO chapter", "キャラ / 作品 / FGO 章 検索"),
  beyblade: copy("搜索 BX / UX / CX / 部件", "BX / UX / CX / 파츠 검색", "Search BX / UX / CX / parts", "BX / UX / CX / パーツ検索"),
};

export function localizedWorldText(value, language = "zh") {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || value.zh || value.en || value.ja || value.ko || "";
}

const ICONS = {
  gundam: '<path d="M4 18 7 6l5-3 5 3 3 12-5-2-3 5-3-5-5 2Z"/><path d="M9 8h6M8 12h8"/>',
  armored_core: '<path d="M6 19 4 9l4-5h8l4 5-2 10-4-3h-4l-4 3Z"/><path d="M8 8h8M9 12h6"/>',
  pokemon: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.5"/>',
  beyblade: '<path d="M5 7h14l-2 5-5 8-5-8-2-5Z"/><path d="M8 10h8M10 5h4"/>',
  fate: '<path d="M12 3 5 8l2 9 5 4 5-4 2-9-7-5Z"/><path d="m9 12 3-5 3 5-3 5-3-5Z"/>',
  bridge: '<path d="M4 18h16M6 18V8l6-4 6 4v10"/><path d="M9 12h6"/>',
  signal: '<path d="M4 16a8 8 0 0 1 16 0M7 16a5 5 0 0 1 10 0M10 16a2 2 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/>',
  mecha: '<path d="M8 5h8l2 5-2 9H8l-2-9 2-5Z"/><path d="M9 9h6M12 5V2"/>',
  hangar: '<path d="M3 20V7l9-4 9 4v13"/><path d="M8 20v-7h8v7"/>',
  pilot: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  base: '<path d="M4 20V8l8-5 8 5v12M8 20v-6h8v6"/>',
  mission: '<path d="M5 4h14v16H5z"/><path d="m8 12 2 2 5-5"/>',
  garage: '<path d="M4 20V7l8-4 8 4v13"/><path d="M8 17h8M9 11h6"/>',
  storage: '<path d="M4 6h16v14H4zM4 10h16"/><path d="M10 14h4"/>',
  raven: '<path d="M4 18 9 6l3-3 3 3 5 12-8-4-8 4Z"/>',
  camp: '<path d="m4 20 8-16 8 16H4Z"/><path d="m12 4 3 16M9 20l3-6 3 6"/>',
  news: '<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h5M8 16h7"/>',
  dex: '<path d="M5 4h14v16H5z"/><circle cx="12" cy="10" r="3"/><path d="M8 16h8"/>',
  bag: '<path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  trainer: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  arena: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5M12 15v5"/>',
  match: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M12 13v4M8 20h8M5 6H3a4 4 0 0 0 4 4M19 6h2a4 4 0 0 1-4 4"/>',
  combo: '<circle cx="12" cy="7" r="3"/><circle cx="8" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><path d="m10 9-1 4m5-4 1 4M11 16h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/>',
  blader: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  chaldea: '<path d="M12 3 5 8l2 9 5 4 5-4 2-9-7-5Z"/><circle cx="12" cy="12" r="3"/>',
  observe: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  spirit: '<path d="M12 3c4 3 6 6 6 10a6 6 0 0 1-12 0c0-4 2-7 6-10Z"/><path d="M9 14c1-2 2-3 3-5 1 2 2 3 3 5"/>',
  vault: '<path d="M4 5h16v15H4z"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M15 12h2M12 15v2M9 12H7"/>',
  master: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="m18 5 1 1 2-2"/>',
};

export function worldIconMarkup(icon, className = "") {
  const paths = ICONS[icon] || ICONS.gundam;
  return `<svg${className ? ` class="${className}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function worldNavItems(franchise, language = "zh") {
  const config = WORLD_THEME_CONFIG[franchise] || WORLD_THEME_CONFIG.gundam;
  return config.nav.map(([view, label, icon]) => ({ view, label: localizedWorldText(label, language), icon }));
}
