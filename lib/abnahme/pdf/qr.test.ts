import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { erzeugeProtokollPdf } from "./protokoll.ts";
import { erzeugeQrPng } from "./qr.ts";
import { leeresProtokoll, neuePosition, neuerRaum } from "../edit.ts";
import { setzeMangel } from "../logic.ts";
import { publicUrl } from "../public-token.ts";

const fontDir = fileURLToPath(new URL("../../../public/fonts/", import.meta.url));
const loader = async (n: string) => new Uint8Array(readFileSync(fontDir + n));
const TOKEN = "Zx9_-AbCdEfGhIjKlMnOpQrStUvWxYz0".slice(0, 32);
const BASIS = "https://schlutte.vercel.app";

function testDoc(mitToken: boolean) {
  let d = { ...leeresProtokoll({ id: "p1", mitarbeiterId: null, mitarbeiterName: "Test" }), kunde: "Wagener", kommissionNr: "250148", status: "abgeschlossen" as const, abgeschlossenAt: "2026-11-27T10:00:00Z" };
  const r = neuerRaum(d, "Küche");
  d = r.doc;
  const p = neuePosition(d, r.raum.id, { titel: "Schrank" });
  d = p.doc;
  d = setzeMangel(d, { positionId: p.position.id, pruefpunktId: null }, { text: "Kratzer", frist: "" });
  return mitToken ? { ...d, publicToken: TOKEN } : d;
}

async function linkUris(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i, PDFDict);
      const act = a.lookup(PDFName.of("A"), PDFDict);
      const uri = act.lookup(PDFName.of("URI"), PDFString);
      out.push(uri.decodeText());
    }
  }
  return out;
}

test("QR-PNG ist ein gültiges PNG", async () => {
  const png = await erzeugeQrPng(publicUrl(TOKEN, BASIS));
  assert.deepEqual([...png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test("PDF mit Token: QR eingebettet, Link im Klartext und als Annotation, Hinweis bei den Mängeln", async () => {
  const doc = testDoc(true);
  const qrPng = await erzeugeQrPng(publicUrl(TOKEN, BASIS));
  const bytes = await erzeugeProtokollPdf(doc, { fonts: loader, bilder: new Map(), qrPng, basisUrl: BASIS });
  if (process.env.ABNAHME_TEST_PDF_OUT) writeFileSync(process.env.ABNAHME_TEST_PDF_OUT, bytes);
  const uris = await linkUris(bytes);
  assert.ok(uris.length >= 3, `Annotationen: ${uris.length}`); // QR, Text, Mängelliste
  assert.ok(uris.every((u) => u === `${BASIS}/p/${TOKEN}`));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const txt = async (n: number) => ((await (await pdf.getPage(n)).getTextContent()).items as { str: string }[]).map((x) => x.str).join(" ");
  const s1 = await txt(1);
  assert.match(s1, /PROTOKOLL UND FOTOS ONLINE/i);
  assert.ok(s1.replace(/\s/g, "").includes(`${BASIS}/p/${TOKEN}`.replace(/\s/g, "")));
  let alle = "";
  for (let i = 1; i <= pdf.numPages; i++) alle += await txt(i);
  assert.match(alle, /Fotos in voller Auflösung/);
});

test("PDF ohne Token (alt): kein QR, keine Link-Annotationen", async () => {
  const bytes = await erzeugeProtokollPdf(testDoc(false), { fonts: loader, bilder: new Map() });
  assert.deepEqual(await linkUris(bytes), []);
});

test("PDF englisch: Beschriftung auf Englisch", async () => {
  const bytes = await erzeugeProtokollPdf({ ...testDoc(true), sprache: "en" }, { fonts: loader, bilder: new Map(), qrPng: await erzeugeQrPng(`${BASIS}/p/${TOKEN}`), basisUrl: BASIS });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const t = ((await (await pdf.getPage(1)).getTextContent()).items as { str: string }[]).map((x) => x.str).join(" ");
  assert.match(t, /RECORD AND PHOTOS ONLINE/i);
});
