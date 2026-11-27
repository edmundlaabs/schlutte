import test from "node:test";
import assert from "node:assert/strict";
import { begrenzeAufPixel, skalaFuerLangeKante } from "./offline/images.ts";
import { pfadOriginal, pfadPdf, pfadVorschau } from "./foto-pfade.ts";
import { speicherKnapp } from "./speicher.ts";

test("Pixelgrenze: unter 16 MP unverändert, darüber proportional knapp darunter", () => {
  assert.deepEqual(begrenzeAufPixel(4032, 3024), { breite: 4032, hoehe: 3024 }); // 12 MP
  const g = begrenzeAufPixel(8000, 6000); // 48 MP
  assert.ok(g.breite * g.hoehe <= 16_000_000);
  assert.ok(g.breite * g.hoehe > 15_000_000);
  assert.ok(Math.abs(g.breite / g.hoehe - 8000 / 6000) < 0.01);
});

test("Lange Kante: 1600/600 px, nie hochskalieren", () => {
  assert.equal(skalaFuerLangeKante(4000, 3000, 1600), 0.4);
  assert.equal(skalaFuerLangeKante(1200, 800, 1600), 1);
  assert.equal(skalaFuerLangeKante(3000, 4000, 600), 0.15);
});

test("Alte Fotos ohne Varianten: überall Fallback auf path", () => {
  const alt = { path: "a/alt.jpg" };
  assert.equal(pfadVorschau(alt), "a/alt.jpg");
  assert.equal(pfadOriginal(alt), "a/alt.jpg");
  assert.equal(pfadPdf(alt), "a/alt.jpg");
});

test("Neue Fotos: Vorschau/Original getrennt, PDF bleibt 1600 px", () => {
  const neu = { path: "a/n.jpg", pathThumb: "a/n.thumb.jpg", pathOriginal: "a/n.orig.jpg" };
  assert.equal(pfadVorschau(neu), "a/n.thumb.jpg");
  assert.equal(pfadOriginal(neu), "a/n.orig.jpg");
  assert.equal(pfadPdf(neu), "a/n.jpg");
  assert.equal(pfadOriginal({ path: "a/n.jpg", pathThumb: "a/n.thumb.jpg", pathOriginal: null }), "a/n.jpg");
});

test("Speicherwarnung: knapp bei < 400 MB frei oder > 85 % belegt", () => {
  const GB = 1024 ** 3;
  assert.equal(speicherKnapp(null), false);
  assert.equal(speicherKnapp({ belegt: 1 * GB, quota: 10 * GB }), false);
  assert.equal(speicherKnapp({ belegt: 9 * GB, quota: 10 * GB }), true);
  assert.equal(speicherKnapp({ belegt: 0.8 * GB, quota: 1 * GB }), true);
});
