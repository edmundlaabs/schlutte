import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fortschritt, kannAbschliessen, offeneUnterschriften, positionStatus, raumAlleIo, relevantePositionen,
  setzeMangel, setzeMehrere, setzeStatus, setzeUnterschrift,
} from "./logic.ts";
import type { Position, ProtokollDoc } from "./types.ts";

function pos(id: string, raumId: string, punkte: number, relevant = true): Position {
  return {
    id, raumId, sort: 0, nr: id, menge: "1", einheit: "Stk", artikel: "", titel: `Pos ${id}`, langtext: "",
    relevant, vorlageId: null, status: "offen", bemerkung: "",
    pruefpunkte: Array.from({ length: punkte }, (_, i) => ({ id: `${id}k${i}`, sort: i, textDe: `P${i}`, textEn: "", status: "offen" as const, bemerkung: "" })),
  };
}

function doc(): ProtokollDoc {
  return {
    id: "d", commissionId: null, kommissionNr: "260081", kunde: "K", projekt: "", titel: "", ort: "Basel", sprache: "de",
    status: "in_arbeit", quelle: "profacto", version: 1, parentId: null, mitarbeiterId: null, mitarbeiterName: "M", teilnehmer: [], kundeEmail: "",
    kopieEmail: "", bemerkung: "", beginnAt: null, abgeschlossenAt: null, originalPath: null, pdfPath: null, rev: 0,
    raeume: [
      { id: "r1", sort: 0, name: "Raum 1", etage: "", materialText: "", bemerkung: "" },
      { id: "r2", sort: 1, name: "Raum 2", etage: "", materialText: "", bemerkung: "" },
    ],
    positionen: [pos("a", "r1", 2), pos("b", "r1", 0), pos("c", "r2", 1), pos("x", "r1", 0, false)],
    maengel: [], fotos: [], unterschriften: [],
  };
}

test("Alle i. O. im Raum setzt Prüfpunkte und Positionen, ignoriert ausgeblendete", () => {
  const d = raumAlleIo(doc(), "r1");
  assert.equal(positionStatus(d.positionen[0]), "io");
  assert.equal(d.positionen[1].status, "io");
  assert.equal(d.positionen[3].status, "offen");
  assert.equal(positionStatus(d.positionen[2]), "offen");
  const f = fortschritt(relevantePositionen(d, "r1"));
  assert.deepEqual(f, { gesamt: 2, offen: 0, io: 2, mangel: 0, nichtPruefbar: 0 });
});

test("Mangel braucht Bemerkung; setzt Positionsstatus auf Mangel", () => {
  const ref = { positionId: "a", pruefpunktId: "ak0" };
  assert.throws(() => setzeMangel(doc(), ref, { text: "  ", frist: "" }));
  const d = setzeMangel(doc(), ref, { text: "Kratzer links", frist: "2026-12-01" });
  assert.equal(d.maengel.length, 1);
  assert.equal(positionStatus(d.positionen[0]), "mangel");
  assert.equal(d.positionen[0].pruefpunkte[0].status, "mangel");
  // erneut: aktualisiert statt dupliziert
  const d2 = setzeMangel(d, ref, { text: "Kratzer rechts", frist: "" });
  assert.equal(d2.maengel.length, 1);
  assert.equal(d2.maengel[0].text, "Kratzer rechts");
});

test("Auf i. O. zurücksetzen entfernt Mangel und liefert Foto-IDs", () => {
  const ref = { positionId: "b", pruefpunktId: null };
  let d = setzeMangel(doc(), ref, { text: "Delle", frist: "" });
  d = { ...d, fotos: [{ id: "f1", mangelId: d.maengel[0].id, path: null, breite: 10, hoehe: 10, aufgenommenAt: "" }] };
  const r = setzeStatus(d, ref, "io");
  assert.deepEqual(r.entfernteFotos, ["f1"]);
  assert.equal(r.doc.maengel.length, 0);
  assert.equal(r.doc.fotos.length, 0);
  assert.equal(r.doc.positionen[1].status, "io");
});

test("Mehrfach-Setzen lässt Mängel stehen", () => {
  let d = setzeMangel(doc(), { positionId: "b", pruefpunktId: null }, { text: "x", frist: "" });
  d = setzeMehrere(d, ["a", "b"], "nicht_pruefbar");
  assert.equal(positionStatus(d.positionen[0]), "nicht_pruefbar");
  assert.equal(d.positionen[1].status, "mangel");
});

test("Unterschriften: pro Raum, Mangel-Positionen zusätzlich", () => {
  let d = raumAlleIo(doc(), "r1");
  d = setzeMangel(d, { positionId: "b", pruefpunktId: null }, { text: "Delle", frist: "" });
  assert.deepEqual(offeneUnterschriften(d), { raeume: ["r1", "r2"], positionen: ["b"] });
  const s1 = setzeUnterschrift(d, { id: "u1", bezug: "raum", bezugId: "r1", name: "Kunde", rolle: "Kunde" });
  const s2 = setzeUnterschrift(s1.doc, { id: "u2", bezug: "raum", bezugId: "r1", name: "Kunde", rolle: "Kunde" });
  assert.equal(s2.ersetzt, "u1");
  assert.equal(s2.doc.unterschriften.length, 1);
});

test("Abschluss: Gründe", () => {
  const d = doc();
  const r = kannAbschliessen(d);
  assert.equal(r.ok, false);
  assert.ok(r.gruende.some((g) => g.includes("noch nicht geprüft")));
  assert.ok(r.gruende.some((g) => g.includes("Kunde")));
  let f = setzeMehrere(d, ["a", "b", "c"], "io");
  f = setzeUnterschrift(f, { id: "s1", bezug: "schluss_kunde", bezugId: null, name: "K", rolle: "Kunde" }).doc;
  f = setzeUnterschrift(f, { id: "s2", bezug: "schluss_mitarbeiter", bezugId: null, name: "M", rolle: "Mitarbeiter" }).doc;
  assert.equal(kannAbschliessen(f).ok, true);
});

import { erzeugeNachtrag } from "./nachtrag.ts";
test("Nachtrag: neue Version, Mangel erledigt, Position i. O., Alt unverändert", () => {
  const alt0 = setzeMangel(doc(), { positionId: "b", pruefpunktId: null }, { text: "Delle", frist: "" });
  const alt = { ...alt0, status: "abgeschlossen" as const, fotos: [{ id: "f1", mangelId: alt0.maengel[0].id, path: "p/f1.jpg", breite: 1, hoehe: 1, aufgenommenAt: "" }] };
  const neu = erzeugeNachtrag(alt, [alt.maengel[0].id], "n1", "2026-12-01T10:00:00Z");
  assert.equal(neu.version, 2);
  assert.equal(neu.parentId, alt.id);
  assert.equal(neu.status, "bereit");
  assert.equal(neu.maengel[0].erledigtAt, "2026-12-01T10:00:00Z");
  assert.notEqual(neu.maengel[0].id, alt.maengel[0].id);
  assert.equal(neu.positionen.find((p) => p.nr === "b")!.status, "io");
  assert.equal(neu.fotos[0].path, "p/f1.jpg");
  assert.equal(neu.fotos[0].mangelId, neu.maengel[0].id);
  assert.equal(neu.unterschriften.length, 0);
  // Alt bleibt unverändert
  assert.equal(alt.maengel[0].erledigtAt, null);
  assert.equal(alt.positionen.find((p) => p.nr === "b")!.status, "mangel");
});

import { entfernePosition, entfernePruefpunkt, fuegePositionHinzu, fuegePruefpunktHinzu, istManuell } from "./logic.ts";
test("Eigene Position und Prüfpunkte hinzufügen/entfernen", () => {
  assert.throws(() => fuegePositionHinzu(doc(), "r1", { titel: " " }));
  let d = fuegePositionHinzu(doc(), "r1", { titel: "Zusatzregal Flur", menge: "1", einheit: "Stk", pruefpunkte: [{ de: "Oberfläche", en: "Surface" }, { de: "  " }] });
  const neu = d.positionen.at(-1)!;
  assert.equal(neu.nr, "N1");
  assert.ok(istManuell(neu));
  assert.equal(neu.pruefpunkte.length, 1);
  assert.equal(positionStatus(neu), "offen");
  d = fuegePruefpunktHinzu(d, neu.id, "Fachböden stabil");
  assert.equal(d.positionen.at(-1)!.pruefpunkte.length, 2);
  // Zusätzlicher Punkt an bestehender, bereits i. O. gesetzter Position → Position wieder offen
  let e = raumAlleIo(doc(), "r1");
  e = fuegePruefpunktHinzu(e, "a", "Neuer Punkt");
  assert.equal(positionStatus(e.positionen[0]), "offen");
  // Mangel als Ganzes blockiert das Anlegen von Prüfpunkten
  const m = setzeMangel(doc(), { positionId: "b", pruefpunktId: null }, { text: "x", frist: "" });
  assert.throws(() => fuegePruefpunktHinzu(m, "b", "Y"));
  // Prüfpunkt mit Mangel entfernen
  const mk = setzeMangel(doc(), { positionId: "a", pruefpunktId: "ak0" }, { text: "Kratzer", frist: "" });
  const r = entfernePruefpunkt(mk, "a", "ak0");
  assert.equal(r.doc.maengel.length, 0);
  assert.equal(r.doc.positionen[0].pruefpunkte.length, 1);
  // Nur eigene Positionen entfernen
  assert.throws(() => entfernePosition(doc(), "a"));
  const ent = entfernePosition(d, neu.id);
  assert.equal(ent.doc.positionen.some((p) => p.id === neu.id), false);
});
