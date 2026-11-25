import test from "node:test";
import assert from "node:assert/strict";
import { fuegeVorlageEin, strukturAusDoc } from "./protokoll-vorlagen.ts";
import { leeresProtokoll, neuerRaum, neuePosition } from "./edit.ts";
import type { ProtokollVorlage, Vorlage } from "./types.ts";

const schrank: Vorlage = { id: "v-schrank", moebeltyp: "Schrank", titelDe: "Schrank", titelEn: "Cabinet", aktiv: true, sort: 1, punkte: [{ de: "Oberfläche", en: "Surface" }, { de: "geputzt", en: "Cleaned" }] };
const regal: Vorlage = { id: "v-regal", moebeltyp: "Regal", titelDe: "Regal", titelEn: "Shelf", aktiv: false, sort: 2, punkte: [{ de: "LED", en: "LED" }] };
const vorlage: ProtokollVorlage = {
  id: "pv", titelDe: "Test", titelEn: "Test", beschreibung: "", aktiv: true, sort: 0,
  raeume: [{
    name: "Flur", etage: "EG", materialText: "Eiche",
    positionen: [
      { titel: "Schrank", einheit: "Stk", beschreibung: "", vorlageId: "v-schrank", pruefpunkte: [{ de: "Beschlag", en: "Hardware" }] },
      { titel: "Regal", einheit: "Stk", beschreibung: "", vorlageId: "v-regal", pruefpunkte: [{ de: "Eigener", en: "Own" }] },
      { titel: "Bank", einheit: "Stk", beschreibung: "Sitzbank", vorlageId: "gibt-es-nicht", pruefpunkte: [] },
    ],
  }],
};
const leer = () => leeresProtokoll({ id: "p", mitarbeiterId: null, mitarbeiterName: "" });

test("Einfügen: neue IDs, Status offen, Prüfpunkte aus Möbeltyp plus eigene", () => {
  const { doc, hinweise } = fuegeVorlageEin(leer(), vorlage, [schrank, regal]);
  assert.equal(doc.raeume.length, 1);
  assert.equal(doc.positionen.length, 3);
  assert.deepEqual(doc.positionen[0].pruefpunkte.map((k) => k.textDe), ["Oberfläche", "geputzt", "Beschlag"]);
  assert.ok(doc.positionen.every((p) => p.status === "offen" && p.relevant));
  assert.ok(doc.positionen.flatMap((p) => p.pruefpunkte).every((k) => k.status === "offen"));
  assert.deepEqual(doc.positionen.map((p) => p.nr), ["1", "2", "3"]);
  assert.equal(doc.positionen[0].vorlageId, "v-schrank");
  // inaktive und fehlende Möbeltyp-Vorlage → Hinweis, eigene Punkte bleiben
  assert.equal(hinweise.length, 2);
  assert.equal(doc.positionen[1].vorlageId, null);
  assert.deepEqual(doc.positionen[1].pruefpunkte.map((k) => k.textDe), ["Eigener"]);
  assert.equal(doc.positionen[2].langtext, "Sitzbank");
});

test("Mehrfach einfügen: Räume zusammenführen, IDs immer neu, Positionen angehängt", () => {
  let d = neuerRaum(leer(), " flur ").doc;
  d = neuePosition(d, d.raeume[0].id, { titel: "Vorhanden" }).doc;
  const erste = fuegeVorlageEin(d, vorlage, [schrank, regal]).doc;
  assert.equal(erste.raeume.length, 1);
  assert.equal(erste.raeume[0].id, d.raeume[0].id);
  assert.equal(erste.raeume[0].etage, "EG"); // leere Etage ergänzt
  assert.equal(erste.positionen.length, 4);
  assert.deepEqual(erste.positionen.map((p) => p.nr), ["1", "2", "3", "4"]);
  const zweite = fuegeVorlageEin(erste, vorlage, [schrank, regal]).doc;
  assert.equal(zweite.raeume.length, 1);
  assert.equal(zweite.positionen.length, 7);
  const ids = zweite.positionen.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const pids = zweite.positionen.flatMap((p) => p.pruefpunkte.map((k) => k.id));
  assert.equal(new Set(pids).size, pids.length);
});

test("Einfügen: bestehende Etage bleibt, neuer Raum wird angelegt", () => {
  let d = neuerRaum(leer(), "Flur", { etage: "OG" }).doc;
  d = fuegeVorlageEin(d, { raeume: [{ name: "Küche", etage: "", materialText: "", positionen: [] }, ...vorlage.raeume] }, [schrank]).doc;
  assert.deepEqual(d.raeume.map((r) => [r.name, r.etage]), [["Flur", "OG"], ["Küche", ""]]);
});

test("Als Vorlage: nur Struktur, Prüfpunkte aus Möbeltyp nicht doppelt", () => {
  let d = leer();
  d = neuerRaum(d, "Flur", { etage: "EG" }).doc;
  const e = neuePosition(d, d.raeume[0].id, { titel: "Schrank", menge: "3", einheit: "Stk", vorlageId: "v-schrank", pruefpunkte: [{ de: "Oberfläche" }, { de: "geputzt" }, { de: "Eigener" }] });
  d = { ...e.doc, kunde: "Meier", kommissionNr: "260081" };
  const s = strukturAusDoc(d, [schrank]);
  assert.equal(s.length, 1);
  assert.equal(s[0].positionen[0].vorlageId, "v-schrank");
  assert.deepEqual(s[0].positionen[0].pruefpunkte, [{ de: "Eigener", en: "Eigener" }]);
  assert.ok(!JSON.stringify(s).includes("Meier"));
  assert.ok(!JSON.stringify(s).includes("260081"));
  // Round-Trip: wieder einfügen ergibt dieselben Prüfpunkte
  const neu = fuegeVorlageEin(leer(), { raeume: s }, [schrank]).doc;
  assert.deepEqual(neu.positionen[0].pruefpunkte.map((k) => k.textDe), ["Oberfläche", "geputzt", "Eigener"]);
});
