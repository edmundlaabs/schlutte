import test from "node:test";
import assert from "node:assert/strict";
import { berechneRegieAenderungen, fuehreRegieZusammen } from "./regie-abgleich.ts";
import { neueZeile, neuesRegieDoc } from "./regie-logic.ts";
import type { RegieDoc } from "./types.ts";

const klon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function basis(): RegieDoc {
  let d = neuesRegieDoc({ kommissionNr: "260081", kunde: "Meier", sprache: "de", mitarbeiterId: "m1", mitarbeiterName: "Anna", heute: "2026-11-26" });
  d = { ...d, rev: 2, zeilen: [{ ...neueZeile(d, "2026-11-26"), text: "Sockel montiert", stdMonteur: 2 }] };
  return d;
}

test("Regie: gleiche Stände ergeben keine Änderungen", () => {
  const b = basis();
  assert.deepEqual(berechneRegieAenderungen(b, klon(b), klon(b)), []);
});

test("Regie: verschiedene Stellen werden zusammengeführt, Konflikt wird erkannt", () => {
  const b = basis();
  const l = klon(b);
  l.zeilen.push({ ...neueZeile(l, "2026-11-26"), text: "Anfahrt (Tablet)", km: 40 });
  l.mitarbeiterName = "Ben"; l.mitarbeiterId = "m2";
  l.zeilen[0].stdMonteur = 3; // Konflikt: Server ändert dieselbe Zeile
  const s = klon(b);
  s.rev = 3;
  s.ort = "Zürich";
  s.zeilen[0].stdMonteur = 4;
  s.zeilen.push({ ...neueZeile(s, "2026-11-26"), text: "Material (Server)" });
  const a = berechneRegieAenderungen(b, l, s);
  const von = Object.fromEntries(a.map((x) => [x.key, x.von]));
  assert.equal(von["kopf:mitarbeiter"], "lokal");
  assert.equal(von["kopf:ort"], "server");
  assert.equal(von[`zeile:${b.zeilen[0].id}`], "beide");
  const m = fuehreRegieZusammen(b, l, s, {});
  assert.equal(m.rev, 3);
  assert.equal(m.ort, "Zürich");
  assert.equal(m.mitarbeiterName, "Ben");
  assert.equal(m.zeilen.length, 3);
  assert.equal(m.zeilen.find((z) => z.id === b.zeilen[0].id)?.stdMonteur, 3); // Vorauswahl bei Konflikt: Tablet
  assert.deepEqual(m.zeilen.map((z) => z.pos), [1, 2, 3]);
  const mitServer = fuehreRegieZusammen(b, l, s, { [`zeile:${b.zeilen[0].id}`]: "server" });
  assert.equal(mitServer.zeilen.find((z) => z.id === b.zeilen[0].id)?.stdMonteur, 4);
});

test("Regie: gelöschte Zeile – löschen oder behalten", () => {
  const b = basis();
  const l = klon(b);
  l.zeilen = [];
  const s = klon(b);
  s.rev = 3;
  const a = berechneRegieAenderungen(b, l, s);
  assert.equal(a.length, 1);
  assert.equal(a[0].von, "lokal");
  assert.equal(a[0].lokal, null);
  assert.equal(fuehreRegieZusammen(b, l, s, {}).zeilen.length, 0);
  assert.equal(fuehreRegieZusammen(b, l, s, { [a[0].key]: "server" }).zeilen.length, 1);
});
