import test from "node:test";
import assert from "node:assert/strict";
import { baueModell, sammlePfade } from "./public-view.ts";
import { istGesperrt, meldeFehlversuch, zuruecksetzenFuerTest } from "./public-rate-limit.ts";
import { leeresProtokoll, neuePosition, neuerRaum } from "./edit.ts";
import { setzeMangel } from "./logic.ts";
import type { ProtokollDoc } from "./types.ts";

function doc(): ProtokollDoc {
  let d: ProtokollDoc = { ...leeresProtokoll({ id: "p1", mitarbeiterId: "emp-geheim", mitarbeiterName: "Max" }), kunde: "Wagener", kommissionNr: "250148", kundeEmail: "kunde@example.com", status: "abgeschlossen", abgeschlossenAt: "2026-11-27T10:00:00Z" };
  const r = neuerRaum(d, "Küche");
  d = r.doc;
  const p = neuePosition(d, r.raum.id, { titel: "Schrank" });
  d = p.doc;
  d = setzeMangel(d, { positionId: p.position.id, pruefpunktId: null }, { text: "Kratzer", frist: "" });
  const mangel = d.maengel[0];
  return {
    ...d,
    fotos: [
      { id: "alt", mangelId: mangel.id, path: "protokoll/p1/fotos/alt.jpg", breite: 1600, hoehe: 1200, aufgenommenAt: "" },
      { id: "neu", mangelId: mangel.id, path: "protokoll/p1/fotos/neu.jpg", pathThumb: "protokoll/p1/fotos/neu.thumb.jpg", pathOriginal: "protokoll/p1/fotos/neu.orig.jpg", breite: 1600, hoehe: 1200, aufgenommenAt: "" },
    ],
    objektFotos: [{ id: "o1", positionId: p.position.id, path: "protokoll/p1/fotos/o1.jpg", breite: 1600, hoehe: 1200, aufgenommenAt: "" }],
  };
}

test("Modell: Alte Fotos nutzen path für Raster und Lightbox, neue Vorschau/Original", () => {
  const d = doc();
  const signed = Object.fromEntries(sammlePfade(d).map((p) => [p, `https://signed/${p}`]));
  const m = baueModell(d, signed, true);
  const [alt, neu] = m.maengel[0].fotos;
  assert.equal(alt.vorschau, "https://signed/protokoll/p1/fotos/alt.jpg");
  assert.equal(alt.original, "https://signed/protokoll/p1/fotos/alt.jpg");
  assert.equal(neu.vorschau, "https://signed/protokoll/p1/fotos/neu.thumb.jpg");
  assert.equal(neu.original, "https://signed/protokoll/p1/fotos/neu.orig.jpg");
  assert.equal(m.maengelFotoAnzahl, 2);
  assert.equal(m.objektFotoAnzahl, 1);
  assert.match(m.maengel[0].fotos[0].caption, /^M1\.1 · Kratzer/);
});

test("Modell enthält keine Mitarbeiter-IDs, E-Mail-Adressen oder Speicherpfade", () => {
  const d = doc();
  const signed = Object.fromEntries(sammlePfade(d).map((p) => [p, `https://signed/x`]));
  const json = JSON.stringify(baueModell(d, signed, true));
  assert.ok(!json.includes("emp-geheim"));
  assert.ok(!json.includes("kunde@example.com"));
  assert.ok(!json.includes("protokoll/p1/"));
});

test("Pfade zum Signieren: Vorschau und Original je Foto, ohne Duplikate", () => {
  const p = sammlePfade(doc());
  assert.equal(new Set(p).size, p.length);
  assert.ok(p.includes("protokoll/p1/fotos/neu.thumb.jpg") && p.includes("protokoll/p1/fotos/neu.orig.jpg"));
});

test("Rate-Limit: nach 30 Fehlversuchen gesperrt, Fenster läuft ab, andere IPs unberührt", () => {
  zuruecksetzenFuerTest();
  const t0 = 1_000_000;
  for (let i = 0; i < 29; i++) meldeFehlversuch("1.2.3.4", t0);
  assert.equal(istGesperrt("1.2.3.4", t0), false);
  meldeFehlversuch("1.2.3.4", t0);
  assert.equal(istGesperrt("1.2.3.4", t0), true);
  assert.equal(istGesperrt("5.6.7.8", t0), false);
  assert.equal(istGesperrt("1.2.3.4", t0 + 11 * 60 * 1000), false);
});
