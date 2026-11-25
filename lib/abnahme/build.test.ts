import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfactoPages } from "./parser/profacto.ts";
import { buildDocFromParsed, OHNE_RAUM } from "./build.ts";
import { suggestVorlage } from "./vorlagen.ts";
import { abnahmeDateiname, kundeKurz, regieDateiname } from "./filename.ts";
import type { Vorlage } from "./types.ts";
import type { TextItem } from "./parser/types.ts";

const vorlagen: Vorlage[] = ["Garderobe", "Schrank", "Regal", "Handlauf"].map((m, i) => ({
  id: `v${i}`, moebeltyp: m, titelDe: m, titelEn: m, aktiv: true, sort: i,
  punkte: [{ de: "Oberfläche", en: "Surface" }, { de: "geputzt", en: "Cleaned" }],
}));

const t = (str: string, x: number, y: number, bold = false): TextItem => ({ str, x, y, bold });

test("suggestVorlage: Stichworte", () => {
  assert.equal(suggestVorlage("Begehbare Ankleide als Raumteiler", vorlagen)?.moebeltyp, "Garderobe");
  assert.equal(suggestVorlage("Schrankanlage", vorlagen)?.moebeltyp, "Schrank");
  assert.equal(suggestVorlage("Regal links", vorlagen)?.moebeltyp, "Regal");
  assert.equal(suggestVorlage("Treppen-Handlauf", vorlagen)?.moebeltyp, "Handlauf");
  assert.equal(suggestVorlage("Kranarbeiten", vorlagen), null);
});

test("buildDocFromParsed: Räume, Zuordnung, Ausgeblendete, Allgemein", () => {
  const parsed = parseProfactoPages([{
    height: 842,
    items: [
      t("260123", 36, 101), t("Küche", 88, 101), t("Max Muster", 268, 101),
      t("1", 44, 133), t("1", 95, 133), t("Stk", 146, 133), t("Schrank vorab", 216, 133, true),
      t("2", 44, 180), t("Wohnen", 216, 180, true), t("Materialien: Eiche", 216, 195),
      t("3", 44, 230), t("1", 95, 230), t("Stk", 146, 230), t("Regal", 216, 230, true),
      t("4", 44, 270), t("1", 95, 270), t("Stk", 146, 270), t("/", 205, 270), t("Mehrpreis Lack", 216, 270),
    ],
  }]);
  const doc = buildDocFromParsed(parsed, vorlagen, { id: "p1", mitarbeiterId: null, mitarbeiterName: "X" });
  assert.deepEqual(doc.raeume.map((r) => r.name), [OHNE_RAUM, "Wohnen"]);
  assert.equal(doc.raeume[1].materialText, "Materialien: Eiche");
  assert.equal(doc.positionen.length, 3);
  assert.equal(doc.positionen[0].raumId, doc.raeume[0].id);
  assert.equal(doc.positionen[1].raumId, doc.raeume[1].id);
  assert.equal(doc.positionen[1].pruefpunkte.length, 2);
  assert.equal(doc.positionen[2].relevant, false);
  assert.equal(doc.positionen[2].raumId, doc.raeume[1].id);
  assert.equal(doc.kommissionNr, "260123");
});

test("Dateiname", () => {
  const d = new Date(2026, 10, 20);
  assert.equal(kundeKurz("Emily Hoon & Stephan Raemy - Uitikon Wal"), "Hoon");
  assert.equal(kundeKurz("Müller GmbH"), "Mueller");
  assert.equal(abnahmeDateiname("260081", "Emily Hoon & Stephan Raemy", d), "Abnahme_260081_Hoon_2026-11-20.pdf");
  // ohne Kommission (Kleinauftrag)
  assert.equal(abnahmeDateiname("", "Emily Hoon & Stephan Raemy", d), "Abnahme_ohne-Kommission_Hoon_2026-11-20.pdf");
  assert.equal(abnahmeDateiname(null, "Müller GmbH", d), "Abnahme_ohne-Kommission_Mueller_2026-11-20.pdf");
  assert.equal(regieDateiname("250210", "Cathy Wei", "2026-02-10"), "Regiebericht_250210_Wei_2026-02-10.pdf");
});

import { docToRows, rowsToDoc } from "./mapping.ts";
test("mapping: Dokument → Zeilen → Dokument (Runde)", () => {
  const parsed = parseProfactoPages([{
    height: 842,
    items: [t("260123", 36, 101), t("Küche", 88, 101), t("Max", 268, 101),
      t("1", 44, 133), t("Wohnen", 216, 133, true),
      t("2", 44, 180), t("1", 95, 180), t("Stk", 146, 180), t("Schrank", 216, 180, true)],
  }]);
  const doc = buildDocFromParsed(parsed, vorlagen, { id: "p1", mitarbeiterId: null, mitarbeiterName: "X" });
  const back = rowsToDoc(docToRows(doc) as never);
  assert.equal(back.positionen.length, 1);
  assert.equal(back.positionen[0].pruefpunkte.length, 2);
  assert.equal(back.raeume[0].name, "Wohnen");
  assert.equal(back.kunde, "Max");
});

import { parsePunkte } from "./vorlagen.ts";
test("parsePunkte", () => {
  assert.deepEqual(parsePunkte("A | a\n\n B \nC|c"), [{ de: "A", en: "a" }, { de: "B", en: "B" }, { de: "C", en: "c" }]);
});
