import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { erzeugeRegiePdf } from "./regie.ts";
import { neueZeile, neuesRegieDoc } from "../regie-logic.ts";

const fontDir = fileURLToPath(new URL("../../../public/fonts/", import.meta.url));
const loader = async (n: string) => new Uint8Array(readFileSync(fontDir + n));
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

async function text(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const d = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= d.numPages; i++) out.push(((await (await d.getPage(i)).getTextContent()).items as { str: string }[]).map((x) => x.str).join(" "));
  return out;
}

function demo(sprache: "de" | "en", n: number) {
  let d = neuesRegieDoc({ kommissionNr: "250210", kunde: "Cathy Wei", sprache, mitarbeiterId: "e", mitarbeiterName: "Eddy Laabs", heute: "2026-02-10" });
  d = { ...d, name: "Cathy Wei", strasse: "Weihenweg 74", ort: "CH 4054 Basel", telefon: "+41 79 000 00 00", beschreibung: "Bücher und Dekoration ausräumen; Regal abbauen und im Keller wieder aufbauen.", unterschriftName: "Cathy Wei", anerkanntAt: "2026-02-10T12:00:00Z", status: "abgeschlossen" };
  for (let i = 0; i < n; i++) {
    const z = neueZeile(d, "2026-02-09");
    d = { ...d, zeilen: [...d.zeilen, { ...z, text: `Arbeitsschritt ${i + 1}: Bücher und Dekoration ausräumen und sorgfältig verpacken`, stdMonteur: 1, stdLehrling: 0.5, km: 12 }] };
  }
  return d;
}

test("Regiebericht-PDF DE: Summen, Hinweise, Seitenumbruch", async () => {
  const bytes = await erzeugeRegiePdf(demo("de", 45), { fonts: loader, bilder: new Map([["x-sig", { bytes: PNG, mime: "image/png" }]]) });
  if (process.env.ABNAHME_TEST_PDF_OUT) writeFileSync(process.env.ABNAHME_TEST_PDF_OUT, bytes);
  const seiten = await text(bytes);
  assert.ok(seiten.length >= 2, `Seiten ${seiten.length}`);
  const alles = seiten.join(" ");
  assert.ok(alles.includes("Die Arbeitszeit versteht sich einschließlich Richten"));
  assert.ok(alles.includes("Grundlage der Auftragsausführung sind die Bestimmungen der VOB"));
  assert.ok(alles.includes("45") && alles.includes("Arbeitsschritt 45"));
  assert.match(alles, /Summe\s+0\s+45\s+22,5\s+0/, "Summen Meister 0 / Monteur 45 / Lehrling 22,5 / Helfer 0");
  assert.ok(alles.includes("67,5"));
  seiten.forEach((tx, i) => assert.ok(tx.includes(`Seite ${i + 1} von ${seiten.length}`)));
  assert.ok(alles.includes("anerkannt, den"));
});

test("Regiebericht-PDF EN", async () => {
  const alles = (await text(await erzeugeRegiePdf(demo("en", 3), { fonts: loader, bilder: new Map() }))).join(" ").replace(/\s+/g, " ");
  assert.ok(alles.includes("Job description and performed work"));
  assert.ok(alles.includes("Working hours include setting up and preparing materials"));
  assert.ok(alles.includes("recognized, date"));
  assert.ok(alles.includes("JOURNEYMAN"));
});
