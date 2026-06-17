import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));

const CHECKS = [
  {
    key: "x_contains_crossbone",
    message: "After War X bucket contains Crossbone units.",
    test: (kit, text) => kit.series?.key === "x" && /クロスボーン|Crossbone|フルクロス|ゴーストガンダム|ファントムガンダム|アンカーガンダム/i.test(text),
  },
  {
    key: "crossbone_contains_seed_gatx",
    message: "Crossbone bucket contains CE / GAT-X units.",
    test: (kit, text) => kit.series?.key === "crossbone" && /GAT-X|イージス|デュエル|バスター|ブリッツ|Aegis|Duel|Buster|Blitz/i.test(text),
  },
  {
    key: "sentinel_contains_hathaway",
    message: "Sentinel bucket contains Hathaway units.",
    test: (kit, text) => kit.series?.key === "sentinel" && /ペーネロペー|Ξガンダム|クスィー|Penelope|Xi Gundam/i.test(text),
  },
  {
    key: "narrative_contains_0080",
    message: "Narrative bucket contains War in the Pocket units.",
    test: (kit, text) => kit.series?.key === "narrative" && /NT-1|アレックス|ケンプファー|Alex|Kampfer/i.test(text),
  },
  {
    key: "zeta_contains_sentinel",
    message: "Z bucket contains Sentinel units.",
    test: (kit, text) => kit.series?.key === "zeta" && /FAZZ|Ex-S|Sガンダム|Zプラス|ゼータプラス|ガンダムMk-V|ディープストライカー/i.test(text),
  },
  {
    key: "zz_contains_sentinel",
    message: "ZZ bucket contains Sentinel units.",
    test: (kit, text) => kit.series?.key === "zz" && /FAZZ|Ex-S|Sガンダム|Zプラス|ゼータプラス|ガンダムMk-V|ディープストライカー/i.test(text),
  },
  {
    key: "uc_first_contains_gqux",
    message: "0079 bucket contains GQuuuuuuX units.",
    test: (kit, text) => kit.series?.key === "uc_first" && /GQuuuuuuX|ジークアクス|\(GQ\)|（GQ）|GFreD/i.test(text),
  },
  {
    key: "build_contains_plain_metal_build",
    message: "Build bucket contains plain METAL BUILD products without Build-series unit names.",
    test: (kit, text) =>
      kit.series?.key === "build" &&
      /METAL_BUILD|METAL BUILD/i.test(text) &&
      !/Gundam Build|Build Fighters|Build Divers|Build Metaverse|ビルド|ダイバー|コアガンダム|アースリィ|ユーラヴェン|ラーガンダム|ベアッガイ|プチッガイ|トライオン|フェニーチェ/i.test(text),
  },
  {
    key: "gundam_contains_non_gundam_series_key",
    message: "Gundam record is assigned to a non-Gundam series bucket.",
    test: (kit) => /^beyblade_|^(pokemon|armored_core)$/.test(kit.series?.key || ""),
  },
];

function kitText(kit) {
  return [
    kit.names?.ja,
    kit.names?.en,
    kit.names?.zh,
    kit.names?.ko,
    kit.work_title,
    kit.universe,
    kit.subline,
    kit.grade_code,
    ...(kit.tags || []),
  ]
    .filter(Boolean)
    .join(" ");
}

const issues = [];
for (const kit of catalog.kits.filter((item) => item.franchise === "gundam")) {
  const text = kitText(kit);
  for (const check of CHECKS) {
    if (check.test(kit, text)) {
      issues.push({
        check: check.key,
        message: check.message,
        kit_id: kit.kit_id,
        series: kit.series?.key || null,
        name: kit.names?.ja || kit.names?.en || kit.kit_id,
      });
    }
  }
}

await writeFile(
  "data/series-audit.json",
  `${JSON.stringify({ updated_at: new Date().toISOString(), count: issues.length, issues }, null, 2)}\n`,
  "utf8",
);

if (issues.length) {
  console.log(`Found ${issues.length} Gundam series audit issue(s).`);
  for (const issue of issues.slice(0, 25)) {
    console.log(`- ${issue.check}: ${issue.kit_id} · ${issue.name}`);
  }
  process.exit(1);
}

console.log("Gundam series audit OK.");
