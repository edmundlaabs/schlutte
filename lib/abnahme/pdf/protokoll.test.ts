import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { erzeugeProtokollPdf } from "./protokoll.ts";
import { buildDocFromParsed } from "../build.ts";
import { parseProfactoPdf } from "../parser/pdf-text.ts";
import { raumAlleIo, setzeMangel, setzeMehrere, setzeUnterschrift } from "../logic.ts";
import type { ProtokollDoc, Vorlage } from "../types.ts";
import { leeresProtokoll, neuePosition, neuerRaum } from "../edit.ts";

const fixture = fileURLToPath(new URL("../parser/__fixtures__/Ang0--1731724496.pdf", import.meta.url));
const fontDir = fileURLToPath(new URL("../../../public/fonts/", import.meta.url));
const loader = async (n: string) => new Uint8Array(readFileSync(fontDir + n));
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

const vorlagen: Vorlage[] = [
  { id: "v1", moebeltyp: "Schrank", titelDe: "Schrank", titelEn: "Cabinet", aktiv: true, sort: 1,
    punkte: [{ de: "Schubladen Funktion", en: "Drawers function" }, { de: "Oberfläche", en: "Surface" }, { de: "geputzt", en: "Cleaned" }] },
  { id: "v2", moebeltyp: "Garderobe", titelDe: "Garderobe", titelEn: "Wardrobe", aktiv: true, sort: 2,
    punkte: [{ de: "LED-Beleuchtung", en: "LED lighting" }, { de: "Oberfläche", en: "Surface" }] },
];

async function textDerSeiten(pdfBytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push((tc.items as { str: string }[]).map((x) => x.str).join(" "));
  }
  return out;
}

async function fertigesDoc(): Promise<ProtokollDoc> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const parsed = await parseProfactoPdf(new Uint8Array(readFileSync(fixture)), pdfjs as never);
  let d = buildDocFromParsed(parsed, vorlagen, { id: "p1", mitarbeiterId: "e1", mitarbeiterName: "Eddy Laabs" });
  d = { ...d, ort: "Uitikon", kunde: "Emily Hoon & Stephan Raemy", teilnehmer: [{ name: "Emily Hoon", rolle: "Kunde" }], beginnAt: "2026-11-20T09:00:00Z" };
  for (const r of d.raeume) d = raumAlleIo(d, r.id);
  const rel = d.positionen.filter((p) => p.relevant);
  d = setzeMangel(d, { positionId: rel[0].id, pruefpunktId: rel[0].pruefpunkte[0]?.id ?? null }, { text: "Kratzer an der Front links, bitte nacharbeiten. ".repeat(4), frist: "2026-12-15" });
  d = setzeMehrere(d, [rel[1].id], "nicht_pruefbar");
  d = { ...d, fotos: [{ id: "f1", mangelId: d.maengel[0].id, path: null, breite: 1, hoehe: 1, aufgenommenAt: "" }] };
  d = setzeUnterschrift(d, { id: "u1", bezug: "raum", bezugId: d.raeume[0].id, name: "Emily Hoon", rolle: "Kunde" }).doc;
  d = setzeUnterschrift(d, { id: "u2", bezug: "schluss_kunde", bezugId: null, name: "Emily Hoon", rolle: "Kunde" }).doc;
  d = setzeUnterschrift(d, { id: "u3", bezug: "schluss_mitarbeiter", bezugId: null, name: "Eddy Laabs", rolle: "Mitarbeiter" }).doc;
  return { ...d, status: "abgeschlossen", abgeschlossenAt: "2026-11-20T11:30:00Z", bemerkung: "Alles in Ordnung bis auf den genannten Mangel." };
}

const skip = existsSync(fixture) ? false : "Fixture fehlt (nur lokal)";

test("PDF Abnahmeprotokoll: Seitenzahl, Fuß, alle Positionen (auch Anhang) und Langtexte enthalten", { skip }, async () => {
  const doc = await fertigesDoc();
  const bilder = new Map([["u1", { bytes: PNG, mime: "image/png" }], ["u2", { bytes: PNG, mime: "image/png" }], ["u3", { bytes: PNG, mime: "image/png" }]]);
  const bytes = await erzeugeProtokollPdf(doc, { fonts: loader, bilder });
  writeFileSync(process.env.ABNAHME_TEST_PDF_OUT ?? "/dev/null", bytes);
  const seiten = await textDerSeiten(bytes);
  assert.ok(seiten.length >= 5, `Seiten: ${seiten.length}`);
  seiten.forEach((txt, i) => {
    assert.ok(txt.includes(`Seite ${i + 1} von ${seiten.length}`), `Fuß Seite ${i + 1}`);
    assert.ok(txt.includes("260081") && txt.includes("Emily Hoon"), `Kommission/Kunde Seite ${i + 1}`);
  });
  const alles = seiten.join(" ").replace(/\s+/g, " ");
  // Alle Positionstitel (auch ausgeblendete im Anhang) und ein Langtext-Ausschnitt je Position
  for (const p of doc.positionen) {
    assert.ok(alles.includes(p.titel.split(" ")[0]), `Titel fehlt: ${p.titel}`);
  }
  assert.ok(alles.includes("Anhang: nicht Gegenstand der Abnahme"));
  assert.ok(alles.includes("Gestalterische Projektierung"));
  assert.ok(alles.includes("Mängelliste") && alles.includes("Kratzer an der Front"));
  assert.ok(alles.includes("Schlussunterschriften"));
});

test("PDF Englisch + Dateiname", { skip }, async () => {
  const doc = { ...(await fertigesDoc()), sprache: "en" as const };
  const bytes = await erzeugeProtokollPdf(doc, { fonts: loader, bilder: new Map() });
  const alles = (await textDerSeiten(bytes)).join(" ");
  assert.ok(alles.includes("Acceptance record"));
  assert.ok(alles.includes("List of defects"));
  assert.ok(alles.includes("Page 1 of"));
});

/** Manuell angelegtes Protokoll ohne Kommission (braucht keine Profacto-Fixture). */
function manuellOhneKommission(sprache: "de" | "en"): ProtokollDoc {
  let d = leeresProtokoll({ id: "m1", mitarbeiterId: "e1", mitarbeiterName: "Eddy Laabs" });
  d = { ...d, kunde: "Anna Muster", sprache, ort: "Kandern", beginnAt: "2026-11-25T09:00:00Z" };
  d = neuerRaum(d, "Flur").doc;
  d = neuePosition(d, d.raeume[0].id, { titel: "Garderobe", menge: "1", einheit: "Stk", vorlageId: "v2", pruefpunkte: vorlagen[1].punkte }).doc;
  return { ...d, status: "in_arbeit" };
}

test("PDF ohne Kommission: Kopf und Fuß zeigen „ohne Kommission“, kein Anhang, kein Absturz", async () => {
  const bytes = await erzeugeProtokollPdf(manuellOhneKommission("de"), { fonts: loader, bilder: new Map() });
  const seiten = await textDerSeiten(bytes);
  const alles = seiten.join(" ").replace(/\s+/g, " ");
  assert.ok(alles.includes("ohne Kommission"));
  assert.ok(alles.includes("Anna Muster"));
  assert.ok(alles.includes("Garderobe"));
  assert.ok(!alles.includes("Anhang: nicht Gegenstand der Abnahme"), "ohne ausgeblendete Positionen kein Anhang");
  seiten.forEach((txt, i) => assert.ok(txt.includes("ohne Kommission · Anna Muster"), `Fuß Seite ${i + 1}`));
});

test("PDF ohne Kommission auf Englisch", async () => {
  const bytes = await erzeugeProtokollPdf(manuellOhneKommission("en"), { fonts: loader, bilder: new Map() });
  const alles = (await textDerSeiten(bytes)).join(" ");
  assert.ok(alles.includes("no commission"));
  assert.ok(alles.includes("Acceptance record"));
});

test("PDF: Objektfoto bei einer i. O.-Position wird gezeichnet", async () => {
  const d = manuellOhneKommission("de");
  const pid = d.positionen[0].id;
  const mit: ProtokollDoc = { ...d, objektFotos: [{ id: "of1", positionId: pid, path: null, breite: 1, hoehe: 1, aufgenommenAt: "2026-11-26T10:00:00Z" }] };
  const bytes = await erzeugeProtokollPdf(mit, { fonts: loader, bilder: new Map([["of1", { bytes: PNG, mime: "image/png" }]]) });
  const alles = (await textDerSeiten(bytes)).join(" ").replace(/\s+/g, " ");
  assert.ok(alles.includes("1 · Foto 1"), "Bildunterschrift Position · Foto 1");
});
