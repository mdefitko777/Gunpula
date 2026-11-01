// Human-maintained table: how each Hobby Atlas work (ids from data/atlas/gundam-ms.json works[])
// maps onto the episode sources used by build_gundam_chapters.mjs.
//
// seasons[]  TV / OVA / ONA runs, in order. Episode numbers are work-wide ("no").
//   official  gundam-official.com /series/<slug> (official JP subtitles). Seasons stored on one
//             page as `addSeasons` are appended automatically.
//   fandom    Gundam Wiki "Series" value(s) of the episode pages (string or array).
//   offset    added to the official episode numbers of this slug (default: continue after the
//             previous slug's last episode when its numbering restarts at 1).
//   fandom_offset  added to the Gundam Wiki episode numbers (default 0: the wiki numbers whole
//             works 1..N, e.g. IRON-BLOODED ORPHANS 1-50, 00 1-50).
// films[]    one "episode" per film: official slug and/or the Gundam Wiki film page (its own
//             Mobile Weapon subobjects). G Gen stages of a film work all cover film 1 unless
//             gget_film maps a G Gen series id to another film number.
// gget_range {G Gen series id: [from, to]} episode range for that series' stages when their
//             titles cannot be anchored (e.g. official subtitles that are only "第N話").
// episode_pages  {episode no: Gundam Wiki page} for episodes the wiki keeps outside the
//             series' episode list (e.g. the Witch from Mercury PROLOGUE).
//
// Works with G Gen stages but no entry here still get arcs (episode ranges stay null).

export const CHAPTER_WORKS = [
  // ---- Universal Century ----
  { id: "mobile-suit-gundam", seasons: [{ official: "mobile-suit-gundam", fandom: "Mobile Suit Gundam" }] },
  { id: "origin", seasons: [{ official: "origin", fandom: "Mobile Suit Gundam: The Origin" }] },
  {
    id: "cucuruz-doans-island",
    films: [{ official: "cucuruz-doans-island", fandom_page: "Mobile Suit Gundam: Cucuruz Doan's Island" }],
  },
  {
    id: "ms-igloo",
    seasons: [
      { official: "ms-igloo-the-hidden-one-year-war", fandom: "Mobile Suit Gundam MS IGLOO: The Hidden One Year War" },
      { official: "ms-igloo-apocalypse-0079", fandom: "Mobile Suit Gundam MS IGLOO: Apocalypse 0079", fandom_offset: 3 },
      { official: "ms-igloo2-the-gravity-front", fandom: "Mobile Suit Gundam MS IGLOO 2: The Gravity Front", fandom_offset: 6 },
    ],
  },
  { id: "08th-ms-team", seasons: [{ official: "08th-ms-team", fandom: "Mobile Suit Gundam: The 08th MS Team" }] },
  { id: "0080-war-in-the-pocket", seasons: [{ official: "0080-war-in-the-pocket", fandom: "Mobile Suit Gundam 0080: War in the Pocket" }] },
  // Official subtitles are just "第N話": G Gen series 320 adapts season 1, 330 (Bandit Flower) season 2.
  { id: "thunderbolt", seasons: [{ official: "thunderbolt", fandom: "Mobile Suit Gundam Thunderbolt" }], gget_range: { 320: [1, 4], 330: [5, 8] } },
  { id: "0083", seasons: [{ official: "0083", fandom: "Mobile Suit Gundam 0083: Stardust Memory" }] },
  { id: "z", seasons: [{ official: "z", fandom: "Mobile Suit Zeta Gundam" }] },
  { id: "zz", seasons: [{ official: "zz", fandom: "Mobile Suit Gundam ZZ" }] },
  { id: "chars-counterattack", films: [{ official: "chars-counterattack", fandom_page: "Mobile Suit Gundam: Char's Counterattack" }] },
  { id: "unicorn", seasons: [{ official: "unicorn", fandom: "Mobile Suit Gundam Unicorn" }] },
  { id: "narrative", films: [{ official: "narrative", fandom_page: "Mobile Suit Gundam Narrative" }] },
  { id: "twilight-axis", films: [{ official: "twilight-axis", fandom_page: "Mobile Suit Gundam Twilight Axis" }] },
  {
    id: "hathaway",
    films: [
      { official: "hathaway-i", fandom_page: "Mobile Suit Gundam Hathaway" },
      { official: "hathaway-ii", fandom_page: "Mobile Suit Gundam Hathaway: The Sorcery of Nymph Circe" },
    ],
  },
  { id: "f91", films: [{ official: "f91", fandom_page: "Mobile Suit Gundam F91" }] },
  { id: "v", seasons: [{ official: "v", fandom: "Mobile Suit Victory Gundam" }] },
  { id: "requiem-for-vengeance", seasons: [{ official: "requiem-for-vengeance", fandom: "Mobile Suit Gundam: Requiem for Vengeance" }] },
  { id: "gquuuuuux", seasons: [{ official: "gquuuuuux", fandom: "Mobile Suit Gundam GQuuuuuuX" }] },
  // ---- Alternative universes ----
  { id: "g", seasons: [{ official: "g", fandom: "Mobile Fighter G Gundam" }] },
  { id: "wing", seasons: [{ official: "wing", fandom: "Mobile Suit Gundam Wing" }] },
  { id: "wing-endless-waltz", seasons: [{ official: "wing-endless-waltz", fandom: "Mobile Suit Gundam Wing Endless Waltz" }] },
  { id: "x", seasons: [{ official: "x", fandom: "After War Gundam X" }] },
  { id: "turn-a", seasons: [{ official: "turn-a", fandom: ["∀ Gundam", "Turn A Gundam"] }] },
  { id: "seed-astray", seasons: [{ fandom: "Mobile Suit Gundam SEED MSV Astray" }] },
  { id: "seed-stargazer", seasons: [{ official: "seed-stargazer", fandom: "Mobile Suit Gundam SEED C.E. 73: STARGAZER" }], gget_range: { 3360: [1, 3] } },
  { id: "seed-freedom-zero", films: [{ official: "seed-freedom-zero", fandom_page: "Mobile Suit Gundam SEED Freedom Zero" }] },
  { id: "seed-freedom", films: [{ official: "seed-freedom", fandom_page: "Mobile Suit Gundam SEED Freedom" }] },
  { id: "seed-destiny", seasons: [{ official: "seed-destiny", fandom: "Mobile Suit Gundam SEED Destiny" }] },
  { id: "seed", seasons: [{ official: "seed", fandom: "Mobile Suit Gundam SEED" }] },
  { id: "00", seasons: [{ official: "00", fandom: "Mobile Suit Gundam 00" }] },
  { id: "age", seasons: [{ official: "age", fandom: "Mobile Suit Gundam AGE" }] },
  { id: "reconguista-in-g", seasons: [{ official: "reconguista-in-g", fandom: "Gundam Reconguista in G" }] },
  {
    id: "orphans",
    seasons: [
      { official: "orphans-1st", fandom: "Mobile Suit Gundam IRON-BLOODED ORPHANS" },
      { official: "orphans-2nd" }, // official numbering already continues at 26
    ],
  },
  {
    id: "witch-from-mercury",
    seasons: [{ official: "witch-from-mercury", fandom: "Mobile Suit Gundam the Witch from Mercury" }],
    episode_pages: { 0: "Mobile Suit Gundam the Witch from Mercury PROLOGUE" },
  },
  // ---- Build series ----
  { id: "gunpla-builders", seasons: [{ official: "gunpla-builders", fandom: "Model Suit Gunpla Builders Beginning G" }] },
  { id: "build-fighters", seasons: [{ official: "build-fighters", fandom: "Gundam Build Fighters" }] },
  { id: "build-fighters-try", seasons: [{ official: "build-fighters-try", fandom: "Gundam Build Fighters Try" }] },
  { id: "build-divers", seasons: [{ official: "build-divers", fandom: "Gundam Build Divers" }] },
  { id: "build-divers-rerise", seasons: [{ official: "build-divers-rerise", fandom: "Gundam Build Divers Re:RISE" }] },
  { id: "build-metaverse", seasons: [{ official: "build-metaverse", fandom: "Gundam Build Metaverse" }] },
  { id: "breaker-battlogue", seasons: [{ official: "breaker-battlogue", fandom: "Gundam Breaker Battlogue" }] },
  // ---- SD ----
  { id: "sd-gundam-world-soketsuden", seasons: [{ official: "sd-gundam-world-soketsuden", fandom: "SD Gundam World Sangoku Soketsuden" }] },
  { id: "sd-gundam-world-heroes", seasons: [{ official: "sd-gundam-world-heros", fandom: "SD Gundam World Heroes" }] },
];

/** Every official slug referenced above, in table order. */
export function officialSlugs() {
  const out = [];
  for (const w of CHAPTER_WORKS) {
    for (const s of [...(w.seasons || []), ...(w.films || [])]) if (s.official && !out.includes(s.official)) out.push(s.official);
  }
  return out;
}

/** Every Gundam Wiki film / extra episode page referenced above. */
export function fandomFilmPages() {
  return CHAPTER_WORKS.flatMap((w) => [...(w.films || []).map((f) => f.fandom_page), ...Object.values(w.episode_pages || {})].filter(Boolean));
}
