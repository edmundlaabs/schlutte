import { test } from "node:test";
import assert from "node:assert/strict";
import { halbeStunden, neueZeile, neuesRegieDoc, nummeriere, regieKannAbschliessen, regieToRows, rowsToRegie, summen } from "./regie-logic.ts";

test("0,5er-Schritte", () => {
  assert.equal(halbeStunden(0.7), 0.5);
  assert.equal(halbeStunden(0.8), 1);
  assert.equal(halbeStunden(-2), 0);
  assert.equal(halbeStunden(NaN), 0);
});

test("Summen je Rolle und gesamt, Pos automatisch", () => {
  let d = neuesRegieDoc({ kommissionNr: "250210", kunde: "Cathy Wei", sprache: "en", mitarbeiterId: null, mitarbeiterName: "M", heute: "2026-02-10" });
  d = { ...d, zeilen: [neueZeile(d, "2026-02-09")] };
  d = { ...d, zeilen: [...d.zeilen, neueZeile(d, "2026-02-10")] };
  d.zeilen[0].stdMeister = 1; d.zeilen[0].stdLehrling = 1;
  d.zeilen[1].stdMonteur = 0.5; d.zeilen[1].stdLehrling = 0.5;
  assert.deepEqual(d.zeilen.map((z) => z.pos), [1, 2]);
  assert.equal(d.zeilen[1].datum, "2026-02-09"); // übernimmt Datum der letzten Zeile
  const s = summen(d.zeilen);
  assert.deepEqual(s, { Meister: 1, Monteur: 0.5, Lehrling: 1.5, Helfer: 0, gesamt: 3 });
  assert.deepEqual(nummeriere([d.zeilen[1], d.zeilen[0]]).map((z) => z.pos), [1, 2]);
});

test("Abschluss braucht Zeilen, Zeit, Unterschrift; Mapping Runde", () => {
  let d = neuesRegieDoc({ kommissionNr: "250210", kunde: "Cathy Wei", sprache: "de", mitarbeiterId: "e", mitarbeiterName: "M", heute: "2026-02-10" });
  assert.equal(regieKannAbschliessen(d).ok, false);
  d = { ...d, zeilen: [{ ...neueZeile(d, "2026-02-10"), text: "Bücher ausräumen", stdMonteur: 1, km: 12.5 }], unterschriftName: "Cathy Wei" };
  assert.equal(regieKannAbschliessen(d).ok, true);
  const rows = regieToRows(d);
  const back = rowsToRegie(rows.regie, rows.zeilen);
  assert.equal(back.zeilen[0].text, "Bücher ausräumen");
  assert.equal(back.zeilen[0].km, 12.5);
  assert.equal(back.zeilen[0].stdMonteur, 1);
  assert.equal(back.kunde, "Cathy Wei");
});
