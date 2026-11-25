import test from "node:test";
import assert from "node:assert/strict";
import { aktion, berechneAenderungen, fuehreZusammen, standardWahl } from "./abgleich.ts";
import { leeresProtokoll, neuePosition, neuerRaum } from "./edit.ts";
import { setzeMangel, setzeStatus } from "./logic.ts";
import type { ProtokollDoc } from "./types.ts";

function basisDoc(): ProtokollDoc {
  let d = leeresProtokoll({ id: "p", mitarbeiterId: "m1", mitarbeiterName: "Anna" });
  d = { ...d, kunde: "Meier", ort: "Basel", status: "in_arbeit", rev: 3 };
  d = neuerRaum(d, "Flur").doc;
  d = neuerRaum(d, "Küche").doc;
  d = neuePosition(d, d.raeume[0].id, { titel: "Schrank", pruefpunkte: [{ de: "Oberfläche" }, { de: "geputzt" }] }).doc;
  d = neuePosition(d, d.raeume[1].id, { titel: "Regal" }).doc;
  return d;
}
const klon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

test("Keine Unterschiede: keine Änderungen", () => {
  const b = basisDoc();
  assert.deepEqual(berechneAenderungen(b, klon(b), klon(b)), []);
});

test("Verschiedene Stellen: automatisch zusammengeführt, Herkunft erkannt", () => {
  const b = basisDoc();
  const pp = b.positionen[0].pruefpunkte;
  // Tablet: Prüfpunkt 1 i. O., Mitarbeiter geändert
  let l = klon(b);
  l = setzeStatus(l, { positionId: l.positionen[0].id, pruefpunktId: pp[0].id }, "io").doc;
  l = { ...l, mitarbeiterId: "m2", mitarbeiterName: "Ben" };
  // Server: anderer Prüfpunkt i. O., Ort geändert, Kommission zugeordnet, Rev 4
  let s = klon(b);
  s = setzeStatus(s, { positionId: s.positionen[0].id, pruefpunktId: pp[1].id }, "io").doc;
  s = { ...s, ort: "Zürich", kommissionNr: "260081", commissionId: "c1", rev: 4 };
  const a = berechneAenderungen(b, l, s);
  const von = Object.fromEntries(a.map((x) => [x.key, x.von]));
  assert.equal(von["kopf:mitarbeiter"], "lokal");
  assert.equal(von["kopf:ort"], "server");
  assert.equal(von["kopf:kommission"], "server");
  assert.equal(von[`pp:${l.positionen[0].id}:${pp[0].id}`], "lokal");
  assert.equal(von[`pp:${l.positionen[0].id}:${pp[1].id}`], "server");
  assert.ok(a.every((x) => x.von !== "beide"));
  const m = fuehreZusammen(b, l, s, {});
  assert.equal(m.rev, 4);
  assert.equal(m.mitarbeiterName, "Ben");
  assert.equal(m.ort, "Zürich");
  assert.equal(m.kommissionNr, "260081");
  assert.deepEqual(m.positionen[0].pruefpunkte.map((k) => k.status), ["io", "io"]);
  assert.equal(m.positionen[0].status, "io");
});

test("Konflikt: dieselbe Stelle verschieden – Auswahl entscheidet", () => {
  const b = basisDoc();
  const pid = b.positionen[0].id;
  const kid = b.positionen[0].pruefpunkte[0].id;
  let l = klon(b);
  l = setzeMangel(l, { positionId: pid, pruefpunktId: kid }, { text: "Kratzer", frist: "" });
  const s = klon(b);
  s.positionen[0].pruefpunkte[0].status = "io";
  s.rev = 4;
  const a = berechneAenderungen(b, l, s);
  const pp = a.find((x) => x.key === `pp:${pid}:${kid}`)!;
  assert.equal(pp.von, "beide");
  assert.equal(standardWahl(pp), "lokal");
  assert.equal(fuehreZusammen(b, l, s, {}).positionen[0].pruefpunkte[0].status, "mangel");
  const mitServer = fuehreZusammen(b, l, s, { [pp.key]: "server" });
  assert.equal(mitServer.positionen[0].pruefpunkte[0].status, "io");
  // der Mangel (nur Tablet) bleibt, solange er nicht abgewählt wird
  assert.equal(mitServer.maengel.length, 1);
  const ohneMangel = fuehreZusammen(b, l, s, { [pp.key]: "server", [a.find((x) => x.gruppe === "Mangel")!.key]: "server" });
  assert.equal(ohneMangel.maengel.length, 0);
});

test("Hinzufügen und Löschen auf beiden Seiten", () => {
  const b = basisDoc();
  let l = klon(b);
  l = neuePosition(l, l.raeume[0].id, { titel: "Bank (Tablet)" }).doc; // neu lokal
  l = { ...l, positionen: l.positionen.filter((p) => p.titel !== "Regal") }; // lokal gelöscht
  let s = klon(b);
  s = neuePosition(s, s.raeume[1].id, { titel: "Tisch (Server)" }).doc; // neu auf Server
  s.rev = 4;
  const a = berechneAenderungen(b, l, s);
  const bank = a.find((x) => x.titel.includes("Bank"))!;
  const tisch = a.find((x) => x.titel.includes("Tisch"))!;
  const regal = a.find((x) => x.titel.includes("Regal"))!;
  assert.deepEqual([bank.von, tisch.von, regal.von], ["lokal", "server", "lokal"]);
  assert.equal(aktion(bank, "lokal"), "hinzufuegen");
  assert.equal(aktion(regal, "lokal"), "loeschen");
  assert.equal(aktion(regal, "server"), "hinzufuegen");
  const alles = fuehreZusammen(b, l, s, {});
  assert.deepEqual(alles.positionen.map((p) => p.titel).sort(), ["Bank (Tablet)", "Schrank", "Tisch (Server)"]);
  // Löschen zurücknehmen und Bank verwerfen
  const w = fuehreZusammen(b, l, s, { [regal.key]: "server", [bank.key]: "server" });
  assert.deepEqual(w.positionen.map((p) => p.titel).sort(), ["Regal", "Schrank", "Tisch (Server)"]);
});

test("Gelöschte Position nimmt Mangel mit; Prüfpunkte nur bei Position auf beiden Seiten einzeln", () => {
  const b = basisDoc();
  const pid = b.positionen[0].id;
  const kid = b.positionen[0].pruefpunkte[0].id;
  let l = klon(b);
  l = setzeMangel(l, { positionId: pid, pruefpunktId: kid }, { text: "Delle", frist: "" });
  const s = klon(b);
  s.positionen = s.positionen.filter((p) => p.id !== pid); // Server löscht die Position
  s.rev = 4;
  const a = berechneAenderungen(b, l, s);
  assert.ok(!a.some((x) => x.key.startsWith("pp:")), "keine Einzelpunkte einer nur einseitig vorhandenen Position");
  const m = fuehreZusammen(b, l, s, {});
  assert.ok(!m.positionen.some((p) => p.id === pid));
  assert.equal(m.maengel.length, 0);
  // Position behalten (Tablet): Prüfpunkte und Mangel kommen mit
  const k = fuehreZusammen(b, l, s, { [`pos:${pid}`]: "lokal" });
  assert.equal(k.positionen.find((p) => p.id === pid)?.pruefpunkte.length, 2);
  assert.equal(k.maengel.length, 1);
});

test("Ohne Basis: Unterschiede gelten als Konflikt, Gleiches bleibt unberührt", () => {
  const b = basisDoc();
  const l = { ...klon(b), ort: "Bern" };
  const s = klon(b);
  const a = berechneAenderungen(null, l, s);
  assert.deepEqual(a.map((x) => [x.key, x.von]), [["kopf:ort", "beide"]]);
});

test("Fotos/Unterschriften: Pfad bleibt erhalten, Waisen entfallen", () => {
  const b = basisDoc();
  const pid = b.positionen[0].id;
  let l = klon(b);
  l = setzeMangel(l, { positionId: pid, pruefpunktId: null }, { text: "Riss", frist: "" });
  l = { ...l, fotos: [{ id: "f1", mangelId: l.maengel[0].id, path: null, breite: 1, hoehe: 1, aufgenommenAt: "" }] };
  l = { ...l, unterschriften: [{ id: "u1", bezug: "raum", bezugId: l.raeume[0].id, name: "Kunde", rolle: "Kunde", bildPath: null, zeitpunkt: "2026-11-25T10:00:00Z" }] };
  const s = klon(b);
  s.rev = 4;
  const m = fuehreZusammen(b, l, s, {});
  assert.equal(m.fotos.length, 1);
  assert.equal(m.unterschriften.length, 1);
  const ohneRaum = fuehreZusammen(b, { ...l, raeume: l.raeume }, { ...s, raeume: s.raeume.filter((r) => r.id !== l.raeume[0].id) }, { [`raum:${l.raeume[0].id}`]: "server" });
  assert.equal(ohneRaum.unterschriften.length, 0);
});

test("Objektfotos: Abgleich hinzufügen/verwerfen, Waisen entfallen", () => {
  const b = basisDoc();
  const pid = b.positionen[0].id;
  const l = klon(b);
  l.objektFotos = [{ id: "of1", positionId: pid, path: null, breite: 1, hoehe: 1, aufgenommenAt: "" }];
  const s = klon(b);
  s.rev = 4;
  const a = berechneAenderungen(b, l, s);
  const f = a.find((x) => x.key === "objfoto:of1")!;
  assert.equal(f.gruppe, "Objektfoto");
  assert.equal(f.von, "lokal");
  assert.equal(fuehreZusammen(b, l, s, {}).objektFotos?.length, 1);
  assert.equal(fuehreZusammen(b, l, s, { [f.key]: "server" }).objektFotos?.length, 0);
  // Position auf dem Server gelöscht, Tablet behält sie nicht → Foto entfällt mit
  const s2 = klon(s);
  s2.positionen = s2.positionen.filter((p) => p.id !== pid);
  assert.equal(fuehreZusammen(b, l, s2, { [`pos:${pid}`]: "server" }).objektFotos?.length, 0);
});
