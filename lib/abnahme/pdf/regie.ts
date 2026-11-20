import { PDFDocument, type PDFImage, type PDFPage } from "pdf-lib";
import { formatDatum, t } from "../i18n.ts";
import { ROLLEN, STD_KEYS, summen } from "../regie-logic.ts";
import type { RegieDoc } from "../types.ts";
import { A4_QUER, bettePng, brass, kuerzen, ladeFonts, ink, muted, Seiten, umbrechen, line as faint } from "./common.ts";
import { zeichneLogo } from "./logo.ts";
import type { PdfOptionen } from "./protokoll.ts";

const M = 36;
const BOTTOM = 52;
const TOP = 54;
const stdFormat = (n: number) => (n === 0 ? "" : String(n).replace(".", ","));

/** Regiebericht (Stundenbericht) als A4 quer – wie die Papiervorlage, mit Summen je Rolle. */
export async function erzeugeRegiePdf(doc: RegieDoc, opt: PdfOptionen): Promise<Uint8Array> {
  const L = t(doc.sprache);
  const pdf = await PDFDocument.create();
  const f = await ladeFonts(pdf, opt.fonts);
  pdf.setTitle(`${L.regieKurz} ${doc.kommissionNr} ${doc.kunde}`);
  pdf.setAuthor(doc.mitarbeiterName || "Grabner Design GmbH");
  pdf.setCreator("Schlutte");
  const W = A4_QUER.w;

  const cols: { key: string; titel: string; w: number; align?: "right" }[] = [
    { key: "pos", titel: L.pos, w: 28 },
    { key: "datum", titel: L.datumKurz, w: 62 },
    { key: "text", titel: L.beschreibung, w: 296 },
    { key: "menge", titel: L.menge, w: 40 },
    { key: "laenge", titel: L.laenge, w: 40 },
    { key: "breite", titel: L.breite, w: 40 },
    { key: "staerke", titel: L.staerke, w: 40 },
    { key: "km", titel: L.km, w: 36, align: "right" },
    { key: "stdMeister", titel: L.meister, w: 45, align: "right" },
    { key: "stdMonteur", titel: L.monteur, w: 48, align: "right" },
    { key: "stdLehrling", titel: L.lehrling, w: 48, align: "right" },
    { key: "stdHelfer", titel: L.helfer, w: 42, align: "right" },
  ];
  const xs: number[] = [];
  cols.reduce((x, c) => (xs.push(x), x + c.w), M);
  const tabBreite = cols.reduce((n, c) => n + c.w, 0);

  let tabellenKopfY = 0;
  const kopfErste = (page: PDFPage): number => {
    const top = A4_QUER.h - M;
    zeichneLogo(page, M, top, 100, ink, brass);
    const firma = ["Grabner Design GmbH", "Tüchlinger Weg 1", "79400 Kandern", "Tel. +49(0)7626-977210", "Mail: info@grabner-design.de"];
    firma.forEach((z, i) => page.drawText(z, { x: W - M - f.regular.widthOfTextAtSize(z, 8), y: top - 8 - i * 10.5, font: f.regular, size: 8, color: muted }));
    page.drawText(`SCHLUTTE / ${L.regieKurz.toUpperCase()}`, { x: M, y: top - 44, font: f.regular, size: 8, color: brass });
    page.drawText(L.regie, { x: M, y: top - 66, font: f.light, size: 20, color: ink });
    return top - 82;
  };
  const kopfFolge = (page: PDFPage): number => {
    page.drawText(`${L.regieKurz} · ${doc.kommissionNr} · ${doc.kunde}`, { x: M, y: A4_QUER.h - 30, font: f.regular, size: 8, color: muted });
    page.drawLine({ start: { x: M, y: A4_QUER.h - 36 }, end: { x: W - M, y: A4_QUER.h - 36 }, thickness: 0.5, color: muted });
    const y = A4_QUER.h - TOP - 4;
    return y;
  };
  const s = new Seiten(pdf, A4_QUER, M, TOP, BOTTOM, (page, nr) => (nr === 1 ? kopfErste(page) : kopfFolge(page)));

  function zeilen(text: string, font: typeof f.regular, size: number, farbe = ink, breite = s.width, abstand = 1.25) {
    for (const z of umbrechen(text, font, size, breite)) {
      s.platz(size * abstand);
      s.page.drawText(z, { x: M, y: s.y - size, font, size, color: farbe });
      s.nachUnten(size * abstand);
    }
  }
  const feld = (x: number, y: number, label: string, wert: string, breite: number) => {
    s.page.drawText(label.toUpperCase(), { x, y: y - 8, font: f.regular, size: 7, color: brass });
    s.page.drawText(kuerzen(wert || "—", f.regular, 10, breite), { x, y: y - 20, font: f.regular, size: 10, color: ink });
  };

  // Kopfdaten
  const spalte = (s.width - 3 * 12) / 4;
  feld(M, s.y, L.kommission, doc.kommissionNr, spalte);
  feld(M + (spalte + 12), s.y, L.kunde, doc.kunde, spalte);
  feld(M + 2 * (spalte + 12), s.y, L.name, doc.name, spalte);
  feld(M + 3 * (spalte + 12), s.y, L.datumKurz, formatDatum(doc.datum, doc.sprache), spalte);
  s.nachUnten(30);
  feld(M, s.y, L.strasse, doc.strasse, spalte);
  feld(M + (spalte + 12), s.y, L.ort, doc.ort, spalte);
  feld(M + 2 * (spalte + 12), s.y, L.tel, doc.telefon, spalte);
  s.nachUnten(34);
  if (doc.beschreibung.trim()) {
    s.page.drawText(L.auftrag.toUpperCase(), { x: M, y: s.y - 8, font: f.regular, size: 7, color: brass });
    s.nachUnten(12);
    zeilen(doc.beschreibung, f.regular, 10);
    s.nachUnten(8);
  }

  // Tabelle
  const tabellenkopf = () => {
    s.platz(34);
    s.page.drawLine({ start: { x: M, y: s.y }, end: { x: M + tabBreite, y: s.y }, thickness: 0.8, color: ink });
    cols.forEach((c, i) => {
      const w = f.regular.widthOfTextAtSize(c.titel.toUpperCase(), 6.5);
      const x = c.align === "right" ? xs[i] + c.w - 3 - w : xs[i] + 3;
      s.page.drawText(c.titel.toUpperCase(), { x, y: s.y - 12, font: f.regular, size: 6.5, color: brass });
    });
    s.page.drawText(L.arbeitszeit.toUpperCase(), { x: xs[8] + 3, y: s.y - 21, font: f.regular, size: 6, color: muted });
    s.nachUnten(26);
    s.page.drawLine({ start: { x: M, y: s.y }, end: { x: M + tabBreite, y: s.y }, thickness: 0.5, color: muted });
    tabellenKopfY = s.y;
  };
  tabellenkopf();

  for (const [idx, z] of doc.zeilen.entries()) {
    const textZeilen = umbrechen(z.text || "", f.regular, 9, cols[2].w - 6);
    const h = Math.max(1, textZeilen.length) * 11 + 6;
    // Die letzte Zeile bleibt mit Summen, Hinweisen und Unterschrift auf einer Seite.
    const reserve = idx === doc.zeilen.length - 1 ? 200 : 8;
    if (s.y - h < BOTTOM + reserve) {
      s.neu();
      tabellenkopf();
    }
    const y0 = s.y;
    const wert: Record<string, string> = {
      pos: String(z.pos), datum: formatDatum(z.datum, doc.sprache), menge: z.menge, laenge: z.laenge, breite: z.breite, staerke: z.staerke,
      km: z.km == null ? "" : String(z.km).replace(".", ","), stdMeister: stdFormat(z.stdMeister), stdMonteur: stdFormat(z.stdMonteur),
      stdLehrling: stdFormat(z.stdLehrling), stdHelfer: stdFormat(z.stdHelfer),
    };
    cols.forEach((c, i) => {
      if (c.key === "text") {
        textZeilen.forEach((tz, k) => s.page.drawText(tz, { x: xs[i] + 3, y: y0 - 11 - k * 11, font: f.regular, size: 9, color: ink }));
        return;
      }
      const v = kuerzen(wert[c.key] ?? "", f.regular, 9, c.w - 6);
      const w = f.regular.widthOfTextAtSize(v, 9);
      s.page.drawText(v, { x: c.align === "right" ? xs[i] + c.w - 3 - w : xs[i] + 3, y: y0 - 11, font: f.regular, size: 9, color: ink });
    });
    s.nachUnten(h);
    s.page.drawLine({ start: { x: M, y: s.y }, end: { x: M + tabBreite, y: s.y }, thickness: 0.25, color: faint });
  }
  void tabellenKopfY;

  // Summen
  const sum = summen(doc.zeilen);
  s.platz(60);
  s.page.drawLine({ start: { x: M, y: s.y }, end: { x: M + tabBreite, y: s.y }, thickness: 0.8, color: ink });
  s.page.drawText(L.summe, { x: xs[2] + 3, y: s.y - 13, font: f.medium, size: 9.5, color: ink });
  ROLLEN.forEach((r, k) => {
    const i = 8 + k;
    const v = String(sum[r]).replace(".", ",");
    s.page.drawText(v, { x: xs[i] + cols[i].w - 3 - f.medium.widthOfTextAtSize(v, 9.5), y: s.y - 13, font: f.medium, size: 9.5, color: ink });
  });
  s.nachUnten(18);
  const gesamt = `${L.summe} ${L.arbeitszeit}: ${String(sum.gesamt).replace(".", ",")}`;
  s.page.drawText(gesamt, { x: M + tabBreite - f.medium.widthOfTextAtSize(gesamt, 10), y: s.y - 12, font: f.medium, size: 10, color: ink });
  s.nachUnten(22);

  // Hinweise
  zeilen(L.hinweis1, f.regular, 8, muted);
  zeilen(L.hinweis2, f.regular, 8, muted);
  s.nachUnten(8);

  // Abschluss: anerkannt + Unterschrift Kunde
  s.platz(90);
  let sig: PDFImage | null = null;
  const sigBytes = opt.bilder.get(`${doc.id}-sig`);
  if (sigBytes) sig = await bettePng(pdf, sigBytes.bytes);
  const datumText = doc.anerkanntAt ? formatDatum(doc.anerkanntAt, doc.sprache) : "";
  s.page.drawText(`${L.anerkannt} ${datumText}`, { x: M, y: s.y - 10, font: f.regular, size: 9.5, color: ink });
  const sx = M + 260;
  if (sig) {
    const sc = Math.min(180 / sig.width, 46 / sig.height);
    s.page.drawImage(sig, { x: sx, y: s.y - 10 - sig.height * sc + 8, width: sig.width * sc, height: sig.height * sc });
  }
  s.page.drawLine({ start: { x: sx, y: s.y - 58 }, end: { x: sx + 220, y: s.y - 58 }, thickness: 0.5, color: muted });
  s.page.drawText(`${L.unterschriftKunde}${doc.unterschriftName ? `: ${doc.unterschriftName}` : ""}`, { x: sx, y: s.y - 69, font: f.regular, size: 8, color: muted });
  s.page.drawText(`${L.ausgefuehrtVon}: ${doc.mitarbeiterName}`, { x: M + 520, y: s.y - 10, font: f.regular, size: 9.5, color: ink });
  s.nachUnten(76);

  const n = s.pages.length;
  s.pages.forEach((page, i) => {
    page.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: muted });
    page.drawText(kuerzen(`${L.kommission} ${doc.kommissionNr} · ${doc.kunde}`, f.regular, 8, s.width - 90), { x: M, y: 26, font: f.regular, size: 8, color: muted });
    const seite = `${L.seite} ${i + 1} ${L.von} ${n}`;
    page.drawText(seite, { x: W - M - f.regular.widthOfTextAtSize(seite, 8), y: 26, font: f.regular, size: 8, color: muted });
  });
  void STD_KEYS;
  return pdf.save();
}
