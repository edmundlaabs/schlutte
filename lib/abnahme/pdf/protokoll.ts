import { PDFDocument, type PDFImage, type PDFPage } from "pdf-lib";
import { formatDatum, formatDatumZeit, t } from "../i18n.ts";
import { fortschritt, findeUnterschrift, maengelPositionen, positionStatus, relevantePositionen } from "../logic.ts";
import type { Position, ProtokollDoc, PruefStatus, Raum, Unterschrift } from "../types.ts";
import { A4, bettePng, betteJpg, brass, faint, green, ink, kuerzen, ladeFonts, muted, red, Seiten, umbrechen, type FontLoader, type Fonts } from "./common.ts";

export type PdfBild = { bytes: Uint8Array; mime: string };
export type PdfOptionen = {
  fonts: FontLoader;
  /** Fotos und Unterschriften nach ID. */
  bilder: Map<string, PdfBild>;
  /** Logo als PNG (im Browser aus dem SVG gerendert); ohne Logo erscheint der Schriftzug. */
  logoPng?: Uint8Array | null;
};

const M = 42;
const BOTTOM = 62;
const TOP_FOLGESEITE = 62;
const LOGO_RATIO = 566.93 / 155.3;

const statusFarbe = (s: PruefStatus) => (s === "io" ? green : s === "mangel" ? red : muted);

export async function erzeugeProtokollPdf(doc: ProtokollDoc, opt: PdfOptionen): Promise<Uint8Array> {
  const L = t(doc.sprache);
  const pdf = await PDFDocument.create();
  const f: Fonts = await ladeFonts(pdf, opt.fonts);
  pdf.setTitle(`${L.protokoll} ${doc.kommissionNr} ${doc.kunde}`);
  pdf.setAuthor(doc.mitarbeiterName || "Grabner Design GmbH");
  pdf.setCreator("Schlutte");
  const logo = opt.logoPng ? await bettePng(pdf, opt.logoPng) : null;
  const bildCache = new Map<string, PDFImage | null>();
  async function bild(id: string): Promise<PDFImage | null> {
    if (bildCache.has(id)) return bildCache.get(id)!;
    const b = opt.bilder.get(id);
    const img = b ? (b.mime.includes("png") ? await bettePng(pdf, b.bytes) : await betteJpg(pdf, b.bytes)) : null;
    bildCache.set(id, img);
    return img;
  }

  const kopfErste = (page: PDFPage): number => {
    const top = A4.h - M;
    if (logo) {
      const w = 128;
      page.drawImage(logo, { x: M, y: top - w / LOGO_RATIO, width: w, height: w / LOGO_RATIO });
    } else {
      page.drawText("Grabner Design", { x: M, y: top - 16, font: f.medium, size: 14, color: ink });
    }
    page.drawText(`SCHLUTTE / ${L.protokoll.toUpperCase()}`, { x: A4.w - M - f.regular.widthOfTextAtSize(`SCHLUTTE / ${L.protokoll.toUpperCase()}`, 8), y: top - 8, font: f.regular, size: 8, color: brass });
    page.drawText(L.protokoll, { x: M, y: top - 78, font: f.light, size: 26, color: ink });
    return top - 100;
  };
  const kopfFolge = (page: PDFPage): number => {
    page.drawText(`${L.protokoll} · ${doc.kommissionNr} · ${doc.kunde}`, { x: M, y: A4.h - 38, font: f.regular, size: 8, color: muted });
    page.drawLine({ start: { x: M, y: A4.h - 44 }, end: { x: A4.w - M, y: A4.h - 44 }, thickness: 0.5, color: muted });
    return A4.h - TOP_FOLGESEITE - 6;
  };
  const s = new Seiten(pdf, A4, M, TOP_FOLGESEITE, BOTTOM, (page, nr) => (nr === 1 ? kopfErste(page) : kopfFolge(page)));

  // ── Helfer ──
  const rechts = (text: string, font: typeof f.regular, size: number) => A4.w - M - font.widthOfTextAtSize(text, size);
  function zeilen(text: string, font: typeof f.regular, size: number, farbe = ink, einzug = 0, abstand = 1.25, breite = s.width - einzug) {
    for (const z of umbrechen(text, font, size, breite)) {
      s.platz(size * abstand);
      s.page.drawText(z, { x: M + einzug, y: s.y - size, font, size, color: farbe });
      s.nachUnten(size * abstand);
    }
  }
  function ueberschrift(text: string, size = 13) {
    s.platz(size + 28);
    s.nachUnten(10);
    s.page.drawText(text.toUpperCase(), { x: M, y: s.y - 9, font: f.regular, size: 8, color: brass });
    s.nachUnten(12);
    s.page.drawText(text, { x: M, y: s.y - size, font: f.light, size, color: ink });
    s.nachUnten(size + 6);
    s.page.drawLine({ start: { x: M, y: s.y }, end: { x: A4.w - M, y: s.y }, thickness: 0.5, color: muted });
    s.nachUnten(8);
  }
  function kv(label: string, wert: string) {
    if (!wert.trim()) return;
    const lines = umbrechen(wert, f.regular, 9.5, s.width - 150);
    s.platz(lines.length * 12.5 + 2);
    s.page.drawText(label.toUpperCase(), { x: M, y: s.y - 9, font: f.regular, size: 7.5, color: brass });
    lines.forEach((z, i) => s.page.drawText(z, { x: M + 150, y: s.y - 9.5 - i * 12.5, font: f.regular, size: 9.5, color: ink }));
    s.nachUnten(lines.length * 12.5 + 2);
  }
  async function unterschriftBlock(u: Unterschrift | undefined, titel: string) {
    s.platz(78);
    s.page.drawText(titel.toUpperCase(), { x: M, y: s.y - 8, font: f.regular, size: 7.5, color: brass });
    s.nachUnten(12);
    const img = u ? await bild(u.id) : null;
    if (img) {
      const sc = Math.min(150 / img.width, 42 / img.height);
      s.page.drawImage(img, { x: M, y: s.y - img.height * sc, width: img.width * sc, height: img.height * sc });
    }
    s.page.drawLine({ start: { x: M, y: s.y - 46 }, end: { x: M + 200, y: s.y - 46 }, thickness: 0.5, color: muted });
    s.page.drawText(u ? `${u.name} · ${formatDatumZeit(u.zeitpunkt, doc.sprache)}` : L.nein, { x: M, y: s.y - 57, font: f.regular, size: 8, color: u ? muted : red });
    s.nachUnten(66);
  }
  const status = (st: PruefStatus) => L.status[st];

  // ── 1. Kopf ──
  const versionText = doc.version > 1 ? String(doc.version) : "";
  kv(L.kommission, doc.kommissionNr);
  kv(L.kunde, doc.kunde);
  kv(L.projekt, doc.projekt);
  if (doc.titel.trim()) kv(doc.sprache === "en" ? "Title" : "Bezeichnung", doc.titel);
  kv(L.ort, doc.ort);
  kv(L.datum, formatDatumZeit(doc.abgeschlossenAt ?? doc.beginnAt, doc.sprache));
  kv(L.mitarbeiter, doc.mitarbeiterName);
  kv(L.teilnehmer, doc.teilnehmer.map((x) => (x.rolle ? `${x.name} (${x.rolle})` : x.name)).join(", "));
  if (versionText) kv(L.version, versionText);

  // ── 2. Gesamtübersicht ──
  ueberschrift(L.uebersicht);
  const col = { raum: M, pos: M + 215, io: M + 270, mangel: M + 310, nicht: M + 355, offen: M + 425, sig: M + 465 };
  s.platz(30);
  for (const [x, txt] of [[col.raum, L.raum], [col.pos, L.positionen], [col.io, L.io], [col.mangel, L.mangel], [col.nicht, L.nichtPruefbar], [col.offen, L.offen], [col.sig, L.unterschrift]] as [number, string][]) {
    s.page.drawText(txt.toUpperCase(), { x, y: s.y - 8, font: f.regular, size: 7, color: brass });
  }
  s.nachUnten(14);
  const alle = relevantePositionen(doc);
  for (const r of doc.raeume) {
    const fp = fortschritt(relevantePositionen(doc, r.id));
    if (fp.gesamt === 0) continue;
    s.platz(16);
    s.page.drawText(kuerzen(`${r.etage ? `${r.etage} · ` : ""}${r.name}`, f.regular, 9, 205), { x: col.raum, y: s.y - 10, font: f.regular, size: 9, color: ink });
    const sig = Boolean(findeUnterschrift(doc, "raum", r.id));
    for (const [x, v, c] of [[col.pos, fp.gesamt, ink], [col.io, fp.io, ink], [col.mangel, fp.mangel, fp.mangel ? red : ink], [col.nicht, fp.nichtPruefbar, ink], [col.offen, fp.offen, fp.offen ? red : ink]] as [number, number, typeof ink][]) {
      s.page.drawText(String(v), { x, y: s.y - 10, font: f.regular, size: 9, color: c });
    }
    s.page.drawText(sig ? L.ja : L.nein, { x: col.sig, y: s.y - 10, font: f.regular, size: 9, color: sig ? ink : red });
    s.nachUnten(15);
  }
  const ges = fortschritt(alle);
  s.platz(22);
  s.page.drawLine({ start: { x: M, y: s.y - 2 }, end: { x: A4.w - M, y: s.y - 2 }, thickness: 0.5, color: muted });
  s.page.drawText(L.gesamt, { x: col.raum, y: s.y - 13, font: f.medium, size: 9, color: ink });
  for (const [x, v] of [[col.pos, ges.gesamt], [col.io, ges.io], [col.mangel, ges.mangel], [col.nicht, ges.nichtPruefbar], [col.offen, ges.offen]] as [number, number][]) {
    s.page.drawText(String(v), { x, y: s.y - 13, font: f.medium, size: 9, color: ink });
  }
  s.nachUnten(22);
  const offeneMaengel = doc.maengel.filter((m) => !m.erledigtAt).length;
  kv(L.offeneMaengel, String(offeneMaengel));

  // ── 3. Räume ──
  async function raumBlock(r: Raum) {
    const ps = doc.positionen.filter((p) => p.raumId === r.id && p.relevant);
    s.platz(230);
    ueberschrift(`${r.etage ? `${r.etage} · ` : ""}${r.name}`, 16);
    if (r.materialText.trim()) {
      s.page.drawText(L.materialangaben.toUpperCase(), { x: M, y: s.y - 8, font: f.regular, size: 7.5, color: brass });
      s.nachUnten(12);
      zeilen(r.materialText, f.regular, 8.5, muted);
      s.nachUnten(6);
    }
    for (const p of ps) await positionBlock(p);
    if (r.bemerkung.trim()) {
      s.nachUnten(4);
      s.platz(30);
      s.page.drawText(L.bemerkung.toUpperCase(), { x: M, y: s.y - 8, font: f.regular, size: 7.5, color: brass });
      s.nachUnten(12);
      zeilen(r.bemerkung, f.regular, 9.5);
    }
    s.nachUnten(6);
    await unterschriftBlock(findeUnterschrift(doc, "raum", r.id), `${L.unterschriftRaum}: ${r.name}`);
  }

  async function positionBlock(p: Position) {
    const st = positionStatus(p);
    const titelZeilen = umbrechen(`${p.nr}  ${p.titel}`, f.medium, 10, s.width - 90);
    s.platz(titelZeilen.length * 13 + 30);
    const stText = status(st);
    s.page.drawText(stText, { x: rechts(stText, f.medium, 9), y: s.y - 10, font: f.medium, size: 9, color: statusFarbe(st) });
    for (const z of titelZeilen) {
      s.page.drawText(z, { x: M, y: s.y - 10, font: f.medium, size: 10, color: ink });
      s.nachUnten(13);
    }
    if (p.menge || p.einheit) {
      s.page.drawText(`${L.menge}: ${p.menge} ${p.einheit}`.trim(), { x: M + 14, y: s.y - 8.5, font: f.regular, size: 8.5, color: muted });
      s.nachUnten(11);
    }
    if (p.langtext.trim()) zeilen(p.langtext, f.regular, 8, muted, 14, 1.3);
    for (const k of p.pruefpunkte) {
      s.platz(13);
      const text = doc.sprache === "en" && k.textEn ? k.textEn : k.textDe;
      s.page.drawText(`-  ${kuerzen(text, f.regular, 9, s.width - 110)}`, { x: M + 14, y: s.y - 9.5, font: f.regular, size: 9, color: ink });
      const kt = status(k.status);
      s.page.drawText(kt, { x: rechts(kt, f.regular, 9), y: s.y - 9.5, font: f.regular, size: 9, color: statusFarbe(k.status) });
      s.nachUnten(13);
    }
    for (const m of doc.maengel.filter((x) => x.positionId === p.id)) {
      zeilen(`${L.mangel}: ${m.text}${m.frist ? ` (${L.frist} ${formatDatum(m.frist, doc.sprache)})` : ""}`, f.medium, 9, red, 14);
    }
    if (maengelPositionen(doc).some((x) => x.id === p.id)) {
      await unterschriftBlock(findeUnterschrift(doc, "position", p.id), `${L.unterschriftMangel}: ${p.nr}`);
    }
    s.nachUnten(8);
    s.page.drawLine({ start: { x: M, y: s.y + 4 }, end: { x: A4.w - M, y: s.y + 4 }, thickness: 0.25, color: faint });
  }

  for (const r of doc.raeume) {
    if (doc.positionen.some((p) => p.raumId === r.id && p.relevant)) await raumBlock(r);
  }

  // ── 4. Mängelliste mit Fotos ──
  s.platz(240);
  ueberschrift(L.maengelliste, 16);
  if (doc.maengel.length === 0) zeilen(L.keineMaengel, f.regular, 10, muted);
  let nr = 0;
  for (const m of [...doc.maengel].sort((a, b) => a.sort - b.sort)) {
    nr++;
    const pos = doc.positionen.find((p) => p.id === m.positionId);
    const raum = doc.raeume.find((r) => r.id === m.raumId);
    const kopf = `${nr}.  ${raum ? raum.name : ""}${pos ? ` · ${pos.nr} ${pos.titel}` : ""}`;
    s.platz(60);
    zeilen(kopf, f.medium, 10);
    zeilen(m.text, f.regular, 9.5, ink, 14);
    const zusatz = [m.frist ? `${L.frist}: ${formatDatum(m.frist, doc.sprache)}` : "", m.erledigtAt ? `${L.erledigt}: ${formatDatum(m.erledigtAt, doc.sprache)}` : L.offen].filter(Boolean).join(" · ");
    zeilen(zusatz, f.regular, 8.5, m.erledigtAt ? green : muted, 14);
    const fotos = doc.fotos.filter((x) => x.mangelId === m.id);
    const cell = (s.width - 16) / 3;
    for (let i = 0; i < fotos.length; i += 3) {
      const reihe = fotos.slice(i, i + 3);
      const imgs = await Promise.all(reihe.map((x) => bild(x.id)));
      const maxH = 120;
      s.platz(maxH + 8);
      let hMax = 0;
      imgs.forEach((img, k) => {
        if (!img) return;
        const sc = Math.min(cell / img.width, maxH / img.height);
        s.page.drawImage(img, { x: M + k * (cell + 8), y: s.y - img.height * sc, width: img.width * sc, height: img.height * sc });
        hMax = Math.max(hMax, img.height * sc);
      });
      s.nachUnten((hMax || 20) + 8);
    }
    s.nachUnten(6);
  }

  // ── 5. Schluss ──
  s.nachUnten(8);
  s.platz(200);
  ueberschrift(L.schluss);
  if (doc.bemerkung.trim()) {
    s.page.drawText(L.gesamtbemerkung.toUpperCase(), { x: M, y: s.y - 8, font: f.regular, size: 7.5, color: brass });
    s.nachUnten(12);
    zeilen(doc.bemerkung, f.regular, 9.5);
    s.nachUnten(8);
  }
  kv(L.ort_datum, `${doc.ort}, ${formatDatumZeit(doc.abgeschlossenAt, doc.sprache)}`);
  s.nachUnten(6);
  await unterschriftBlock(findeUnterschrift(doc, "schluss_kunde", null), L.kundeRolle);
  await unterschriftBlock(findeUnterschrift(doc, "schluss_mitarbeiter", null), L.mitarbeiterRolle);

  // ── 6. Anhang: nicht Gegenstand der Abnahme ──
  const ausgeblendet = doc.positionen.filter((p) => !p.relevant);
  if (ausgeblendet.length) {
    s.neu();
    ueberschrift(L.anhang, 14);
    for (const p of ausgeblendet) {
      const raum = doc.raeume.find((r) => r.id === p.raumId);
      s.platz(40);
      zeilen(`${p.nr}  ${p.titel}${raum ? `  (${raum.name})` : ""}`, f.medium, 9.5);
      if (p.menge || p.einheit || p.artikel) zeilen([p.menge && p.einheit ? `${p.menge} ${p.einheit}` : p.menge || p.einheit, p.artikel].filter(Boolean).join(" · "), f.regular, 8, muted, 14);
      if (p.langtext.trim()) zeilen(p.langtext, f.regular, 8, muted, 14, 1.3);
      s.nachUnten(6);
    }
  }

  // ── Fuß aller Seiten: Kommission + Kunde, „Seite x von y“ ──
  const n = s.pages.length;
  s.pages.forEach((page, i) => {
    page.drawLine({ start: { x: M, y: 46 }, end: { x: A4.w - M, y: 46 }, thickness: 0.5, color: muted });
    page.drawText(kuerzen(`${L.kommission} ${doc.kommissionNr} · ${doc.kunde}`, f.regular, 8, s.width - 90), { x: M, y: 32, font: f.regular, size: 8, color: muted });
    const seite = `${L.seite} ${i + 1} ${L.von} ${n}`;
    page.drawText(seite, { x: A4.w - M - f.regular.widthOfTextAtSize(seite, 8), y: 32, font: f.regular, size: 8, color: muted });
  });

  return pdf.save();
}
