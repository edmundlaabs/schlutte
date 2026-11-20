import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseProfactoPages } from "./profacto.ts";
import { parseProfactoPdf } from "./pdf-text.ts";
import type { PdfPage, TextItem } from "./types.ts";

const FIXTURE = fileURLToPath(new URL("./__fixtures__/Ang0--1731724496.pdf", import.meta.url));

// ── Beispiel-PDF (Kundendaten, nur lokal; ohne Datei werden die Tests übersprungen) ──
const skip = existsSync(FIXTURE) ? false : "Fixture __fixtures__/Ang0--1731724496.pdf fehlt (nur lokal)";

async function parseFixture() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return parseProfactoPdf(new Uint8Array(readFileSync(FIXTURE)), pdfjs as never);
}

test("Beispiel-PDF: Kopf", { skip }, async () => {
  const r = await parseFixture();
  assert.equal(r.kommissionNr, "260081");
  assert.equal(r.projekt, "Einbauschränke für 8142 Uitikon Waldegg");
  assert.equal(r.kunde, "Emily Hoon & Stephan Raemy - Uitikon Wal");
});

test("Beispiel-PDF: 20 Positionen, 4 Räume, 7 relevant, 9 ausgeblendet", { skip }, async () => {
  const r = await parseFixture();
  const p = r.positionen;
  assert.equal(p.length, 20);
  assert.equal(p.filter((x) => x.typ === "raum").length, 4);
  const rel = p.filter((x) => x.typ === "abnahme");
  assert.deepEqual(rel.map((x) => x.nr), ["3", "5", "7", "9", "12", "15", "17"]);
  assert.equal(p.filter((x) => x.typ === "ausgeblendet").length, 9);
});

test("Beispiel-PDF: Räume, doppelte Nr, Lücken, Seitenumbruch", { skip }, async () => {
  const r = await parseFixture();
  const rooms = r.positionen.filter((x) => x.typ === "raum").map((x) => `${x.nr}:${x.titel}`);
  assert.deepEqual(rooms, [
    "2:Ankleide und Highlightbereich im Schlafzimmer",
    "6:Büro und Fitnesszimmer",
    "8:Büro2 und Gästezimmer",
    "11:Treppenschrank",
  ]);
  // Doppelte Nr 7 beide vorhanden (eine relevant, eine Minderpreis).
  const sieben = r.positionen.filter((x) => x.nr === "7");
  assert.equal(sieben.length, 2);
  assert.deepEqual(sieben.map((x) => x.typ), ["abnahme", "ausgeblendet"]);
  assert.ok(r.warnings.some((w) => w.includes("7")));
  // Lücken
  const nrs = r.positionen.map((x) => Number(x.nr));
  for (const missing of [13, 14, 16]) assert.ok(!nrs.includes(missing));
  // Position 3: Titel mit Schrägstrich im Text, Raum 2
  const p3 = r.positionen.find((x) => x.nr === "3")!;
  assert.equal(p3.titel, "Begehbare Ankleide als Raumteiler / booklet V4");
  assert.equal(p3.raum, "Ankleide und Highlightbereich im Schlafzimmer");
  assert.equal(p3.menge, "1");
  assert.equal(p3.einheit, "Stk");
  // Raum-Langtext enthält Materialangaben
  const raum2 = r.positionen.find((x) => x.nr === "2")!;
  assert.match(raum2.langtext, /Frontmaterialien Holz/);
  // Zweizeiliger fetter Titel (Position 5)
  assert.equal(r.positionen.find((x) => x.nr === "5")!.titel, "Schrankinnenbeleuchtung mit integrierten IR-Schalter.");
  // Position 15 läuft über den Seitenumbruch: Text von Seite 3 und 4 in einer Position
  const p15 = r.positionen.find((x) => x.nr === "15")!;
  assert.ok(p15.langtext.split("\n").length > 3);
  // Position 1: Artikelkürzel Z_, ausgeblendet
  const p1 = r.positionen.find((x) => x.nr === "1")!;
  assert.equal(p1.typ, "ausgeblendet");
  assert.equal(p1.artikel, "Z_Projektierung-proj");
  assert.equal(p1.titel, "Gestalterische Projektierung");
});

// ── Synthetische Tests (laufen immer) ──
const t = (str: string, x: number, y: number, bold = false): TextItem => ({ str, x, y, bold });

function page(items: TextItem[]): PdfPage {
  return { height: 842, items };
}

const header = [
  t("Einfache Positionsliste", 103, 65, true),
  t("Seite: 1", 509, 75),
  t("260123", 36, 101),
  t("Küche Musterhaus", 88, 101),
  t("Max Muster", 268, 101),
];

test("Synthetisch: Raum, Position, Ausblenden, Titel ohne Fett, Langtext", () => {
  const r = parseProfactoPages([
    page([
      ...header,
      t("1", 44, 133), t("Wohnzimmer", 216, 133, true), t("/", 205, 133),
      t("Materialien:", 216, 150),
      t("2", 44, 190), t("1", 95, 190), t("Stk", 146, 190), t("Möbel_Reg /", 176, 190), t("Regal links", 250, 190),
      t("Langtext Zeile", 250, 205),
      t("3", 44, 240), t("2", 95, 240), t("lfm", 146, 240), t("Z_Montage /", 176, 240), t("Montage", 250, 240, true),
      t("4", 44, 280), t("1", 95, 280), t("Stk", 146, 280), t("/", 205, 280), t("Mehrpreis Lack", 216, 280),
      t("5", 44, 320), t("1", 95, 320), t("Stk", 146, 320), t("Krankosten", 216, 320, true),
    ]),
  ]);
  assert.equal(r.kommissionNr, "260123");
  assert.equal(r.projekt, "Küche Musterhaus");
  assert.equal(r.kunde, "Max Muster");
  const [raum, regal, montage, mehr, kran] = r.positionen;
  assert.equal(raum.typ, "raum");
  assert.equal(raum.langtext, "Materialien:");
  assert.equal(regal.typ, "abnahme");
  assert.equal(regal.titel, "Regal links");
  assert.equal(regal.artikel, "Möbel_Reg");
  assert.equal(regal.raum, "Wohnzimmer");
  assert.equal(regal.langtext, "Langtext Zeile");
  assert.deepEqual([montage.typ, montage.grund], ["ausgeblendet", "artikel"]);
  assert.deepEqual([mehr.typ, mehr.grund], ["ausgeblendet", "mehrpreis"]);
  assert.deepEqual([kran.typ, kran.grund], ["ausgeblendet", "krankosten"]);
});

test("Synthetisch: Seitenkopf wird ignoriert, Position über Seitenumbruch bleibt eine", () => {
  const r = parseProfactoPages([
    page([...header, t("1", 44, 133), t("1", 95, 133), t("Stk", 146, 133), t("Schrank", 216, 133, true), t("Seite 1 Text", 216, 700)]),
    page([t("Einfache Positionsliste", 103, 65, true), t("Seite: 2", 509, 75), t("Seite 2 Text", 216, 120), t("2", 44, 160), t("1", 95, 160), t("Stk", 146, 160), t("Regal", 216, 160, true)]),
  ]);
  assert.equal(r.positionen.length, 2);
  assert.equal(r.positionen[0].langtext, "Seite 1 Text\nSeite 2 Text");
  assert.ok(!r.positionen[0].langtext.includes("Einfache"));
});

test("Synthetisch: Warnungen bei fehlendem Kopf und Positionen ohne Raum", () => {
  const leer = parseProfactoPages([page([])]);
  assert.ok(leer.warnings.length >= 2);
  const r = parseProfactoPages([
    page([...header, t("1", 44, 133), t("1", 95, 133), t("Stk", 146, 133), t("Schrank", 216, 133, true), t("2", 44, 180), t("Küche", 216, 180, true)]),
  ]);
  assert.equal(r.positionen[0].raum, null);
  assert.ok(r.warnings.some((w) => w.includes("Raum")));
});
