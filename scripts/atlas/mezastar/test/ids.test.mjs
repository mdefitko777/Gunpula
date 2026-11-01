// node --test scripts/atlas/mezastar/test/*.test.mjs   (no network, no dependencies)
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assignPrintingIds, checkOutput, finaliseIds, makeRegistry, stickyTag } from "../lib/ids.mjs";
import { promoFile } from "../merge-jp.mjs";
import { _test } from "../merge-intl.mjs";

const tag = (id, printings, extra = {}) => ({ id, kind: "standard", sets: ["s1"], printings, ...extra });
const pr = (id, region, extra = {}) => ({ id, region, ...extra });

test("JP promo image numbers survive query strings and suffixes", () => {
  assert.deepEqual(promoFile("https://x/special/img/p014.png?v1"), { file: "p014", no: 14 });
  assert.deepEqual(promoFile("https://x/special/img/p137-wxfQcSV7XQ2Z.png"), { file: "p137-wxfQcSV7XQ2Z", no: 137 });
  assert.equal(promoFile("https://x/special/img/p001.png#a").no, 1);
  assert.equal(promoFile("https://x/special/img/logo.png").no, null);
});

test("printing ids: regular tags always carry the set, others only on collision", () => {
  const reg = assignPrintingIds("t:R-1-1", [{ region: "TC", set_hint: "stardust-1" }], { setSuffix: (p) => p.set_hint });
  assert.equal(reg[0].id, "t:R-1-1@TC:stardust-1");
  const std = assignPrintingIds("t:1", [{ region: "EN", set_hint: "s1" }, { region: "EN", set_hint: "s2" }, { region: "EN", set_hint: "s2" }]);
  assert.deepEqual(std.map((p) => p.id), ["t:1@EN", "t:1@EN:s2", "t:1@EN:s2~2"]);
  const v = assignPrintingIds("t:2", [{ region: "JA" }, { region: "JA", variant: "Free Trial" }, { region: "JA", variant: "Free Trial" }]);
  assert.deepEqual(v.map((p) => p.id), ["t:2@JA", "t:2@JA:free-trial", "t:2@JA:free-trial~2"]);
});

test("printing ids are reused for the same image", () => {
  const prev = { tags: [tag("t:1", [pr("t:1@EN:s9", "EN", { img_front: "u1" })])] };
  const r = makeRegistry(prev);
  const ps = assignPrintingIds("t:1", [{ region: "EN", img_front: "u0" }, { region: "EN", img_front: "u1" }], { reg: r });
  assert.deepEqual(ps.map((p) => p.id), ["t:1@EN", "t:1@EN:s9"]);
  assert.equal(stickyTag(r, "EN", "nope", "u1"), "t:1");
});

test("a re-keyed tag gets aliases for the tag and its printings", () => {
  const prev = { tags: [tag("t:L-2-2-solgaleo", [pr("t:L-2-2-solgaleo@TC", "TC", { img_front: "img" })])] };
  const out = { tags: [tag("t:L-2-2-1", [pr("t:L-2-2-1@TC", "TC", { img_front: "img" }), pr("t:L-2-2-1@EN", "EN", { src: "community" })])] };
  const s = finaliseIds(out, prev, makeRegistry(prev));
  assert.deepEqual(out.aliases, { "t:L-2-2-solgaleo": "t:L-2-2-1", "t:L-2-2-solgaleo@TC": "t:L-2-2-1@TC" });
  assert.equal(s.aliases_added.length, 2);
  assert.deepEqual(checkOutput(out, prev), []);
});

test("vanished ids are carried as delisted; --reassign-ids drops them", () => {
  const prev = { tags: [tag("t:1", [pr("t:1@KR", "KR"), pr("t:1@TC", "TC")]), tag("t:2", [pr("t:2@TC", "TC")])] };
  const out = { tags: [tag("t:1", [pr("t:1@KR", "KR")])] };
  finaliseIds(out, prev, makeRegistry(prev));
  assert.ok(out.tags.find((t) => t.id === "t:1").printings.some((p) => p.id === "t:1@TC" && p.delisted));
  assert.ok(out.tags.find((t) => t.id === "t:2")?.delisted);
  assert.deepEqual(checkOutput(out, prev), []);
  const out2 = { tags: [tag("t:1", [pr("t:1@KR", "KR")])] };
  const s = finaliseIds(out2, prev, makeRegistry(prev, { reassign: true }), { reassign: true });
  assert.deepEqual(s.dropped.sort(), ["t:1@TC", "t:2"]);
  assert.equal(checkOutput(out2, prev).length, 1); // the guard still sees the loss
});

test("previous aliases are kept and chains collapse", () => {
  const prev = { aliases: { "t:a": "t:b" }, tags: [tag("t:b", [pr("t:b@TC", "TC", { img_front: "i" })])] };
  const out = { tags: [tag("t:c", [pr("t:c@TC", "TC", { img_front: "i" })])] };
  finaliseIds(out, prev, makeRegistry(prev));
  assert.equal(out.aliases["t:a"], "t:c");
  assert.equal(out.aliases["t:b"], "t:c");
});

test("checkOutput rejects duplicate and malformed ids", () => {
  const out = { tags: [tag("t:1", [pr("t:1@JA:x", "JA"), pr("t:1@JA:x", "JA"), pr("t:9@JA", "JA")]), tag("t:1", [pr("t:1@KR", "KR")])], aliases: { "t:z": "t:nowhere" } };
  const e = checkOutput(out).join("\n");
  assert.match(e, /printing id t:1@JA:x appears 2 times/);
  assert.match(e, /tag id t:1 appears 2 times/);
  assert.match(e, /does not start with 't:1@JA'/);
  assert.match(e, /points to no id/);
});

test("promo form compatibility", () => {
  assert.ok(_test.formsCompatible(null, "Crowned"));
  assert.ok(_test.formsCompatible("Rapid Strike", "Rapid Strike Style"));
  assert.ok(!_test.formsCompatible("Rapid Strike", "Single Strike"));
});

test("committed data files have unique, well-formed ids", () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data/atlas");
  for (const f of ["mezastar-intl.json", "mezastar-jp.json"]) {
    const file = path.join(dir, f);
    if (!existsSync(file)) continue;
    assert.deepEqual(checkOutput(JSON.parse(readFileSync(file, "utf8"))), [], f);
  }
});
