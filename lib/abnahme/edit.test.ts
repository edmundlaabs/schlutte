import test from "node:test";
import assert from "node:assert/strict";
import {
  aendereRaum, aenderePruefpunkt, leeresProtokoll, loeschePosition, loeschePruefpunktEntwurf, loescheRaum, naechsteNr,
  neuePosition, neuerRaum, verschiebePositionen, verschiebeRaum,
} from "./edit.ts";

const start = () => leeresProtokoll({ id: "p", mitarbeiterId: null, mitarbeiterName: "" });

test("Raum anlegen, umbenennen, verschieben, löschen", () => {
  let d = neuerRaum(start(), "Flur").doc;
  d = neuerRaum(d, "Küche").doc;
  assert.deepEqual(d.raeume.map((r) => r.sort), [0, 1]);
  d = aendereRaum(d, d.raeume[0].id, { name: "Eingang", etage: "EG" });
  assert.equal(d.raeume[0].name, "Eingang");
  d = verschiebeRaum(d, d.raeume[0].id, 1);
  assert.deepEqual(d.raeume.map((r) => r.name), ["Küche", "Eingang"]);
  assert.deepEqual(d.raeume.map((r) => r.sort), [0, 1]);
  assert.equal(verschiebeRaum(d, d.raeume[0].id, -1), d);
  d = loescheRaum(d, d.raeume[0].id, "entfernen");
  assert.equal(d.raeume.length, 1);
});

test("Position: Nr fortlaufend, Titel Pflicht, Löschen mit Raum", () => {
  let d = neuerRaum(start(), "Flur").doc;
  const rid = d.raeume[0].id;
  assert.throws(() => neuePosition(d, rid, { titel: " " }), /Titel/);
  d = neuePosition(d, rid, { titel: "Schrank", pruefpunkte: [{ de: "Oberfläche" }, { de: " " }] }).doc;
  d = neuePosition(d, rid, { titel: "Regal" }).doc;
  d = neuePosition(d, rid, { titel: "Handlauf", nr: "7" }).doc;
  d = neuePosition(d, rid, { titel: "Bank" }).doc;
  assert.deepEqual(d.positionen.map((p) => p.nr), ["1", "2", "7", "8"]);
  assert.equal(d.positionen[0].pruefpunkte.length, 1);
  assert.equal(d.positionen[0].pruefpunkte[0].textEn, "Oberfläche");
  assert.equal(naechsteNr({ positionen: [] }), "1");
  const geloescht = loescheRaum(d, rid, "loesen");
  assert.ok(geloescht.positionen.every((p) => p.raumId === null));
  assert.equal(loescheRaum(d, rid, "entfernen").positionen.length, 0);
  d = loeschePosition(d, d.positionen[1].id);
  assert.deepEqual(d.positionen.map((p) => p.sort), [0, 1, 2]);
});

test("Positionen verschieben und Prüfpunkte umbenennen/löschen", () => {
  let d = neuerRaum(start(), "A").doc;
  d = neuerRaum(d, "B").doc;
  const [a, b] = d.raeume;
  const r = neuePosition(d, a.id, { titel: "X", pruefpunkte: [{ de: "eins" }, { de: "zwei" }] });
  d = r.doc;
  d = verschiebePositionen(d, new Set([r.position.id]), b.id);
  assert.equal(d.positionen[0].raumId, b.id);
  assert.equal(verschiebePositionen(d, new Set([r.position.id]), "unbekannt"), d);
  const k = d.positionen[0].pruefpunkte[0];
  d = aenderePruefpunkt(d, r.position.id, k.id, { textDe: "neu" });
  assert.equal(d.positionen[0].pruefpunkte[0].textDe, "neu");
  d = loeschePruefpunktEntwurf(d, r.position.id, k.id);
  assert.deepEqual(d.positionen[0].pruefpunkte.map((x) => [x.textDe, x.sort]), [["zwei", 0]]);
});
