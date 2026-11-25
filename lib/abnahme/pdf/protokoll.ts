import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { formatDatum, formatDatumZeit, t } from "../i18n.ts";
import { hatKommission, kommissionAnzeige } from "../kommission.ts";
import { fortschritt, findeUnterschrift, maengelPositionen, positionStatus, relevantePositionen } from "../logic.ts";
import type { Mangel, Position, ProtokollDoc, PruefStatus, Raum, Unterschrift } from "../types.ts";
import { A4, bettePng, betteJpg, brass, green, ink, kuerzen, ladeFonts, line, muted, red, Seiten, umbrechen, white, type FontLoader, type Fonts } from "./common.ts";
import { zeichneLogo } from "./logo.ts";

export type PdfBild = { bytes: Uint8Array; mime: string };
export type PdfOptionen = {
  fonts: FontLoader;
  /** Fotos und Unterschriften nach ID. */
  bilder: Map<string, PdfBild>;
  /** Nicht mehr verwendet (Logo wird als Vektor gezeichnet); bleibt für Aufrufer kompatibel. */
  logoPng?: Uint8Array | null;
};

/*
 * Layout „Dokument“ (Design C + Raster A, Canvas „Schlutte Abnahme – Redesign“):
 * offizielles Grabner-Design-Logo, Meta-Paar oben rechts mit Linie, nummerierte Abschnitte mit
 * Messing-Unterstrich links, Inhalt rechts; Mängel in Ochsenblut mit Fotos.
 */
const M = 42;
const BOTTOM = 66;
const LW = 118; // linke Spalte
const RX = M + LW + 18; // rechte Spalte x
const RW = A4.w - M - RX; // rechte Spalte Breite
const R = A4.w - M; // rechter Rand

const statusFarbe = (s: PruefStatus): RGB => (s === "io" ? ink : s === "mangel" ? red : muted);

export async function erzeugeProtokollPdf(doc: ProtokollDoc, opt: PdfOptionen): Promise<Uint8Array> {
  const L = t(doc.sprache);
  // Ohne Kommission (Kleinauftrag): statt der Nummer „ohne Kommission“ / „no commission“.
  const hatKomm = hatKommission(doc);
  const kommissionText = kommissionAnzeige(doc.kommissionNr, doc.sprache);
  const pdf = await PDFDocument.create();
  const f: Fonts = await ladeFonts(pdf, opt.fonts);
  pdf.setTitle(`${L.protokoll} ${kommissionText} ${doc.kunde}`);
  pdf.setAuthor(doc.mitarbeiterName || "Grabner Design GmbH");
  pdf.setCreator("Schlutte");
  const bildCache = new Map<string, PDFImage | null>();
  async function bild(id: string): Promise<PDFImage | null> {
    if (bildCache.has(id)) return bildCache.get(id)!;
    const b = opt.bilder.get(id);
    const img = b ? (b.mime.includes("png") ? await bettePng(pdf, b.bytes) : await betteJpg(pdf, b.bytes)) : null;
    bildCache.set(id, img);
    return img;
  }
  const datumDok = doc.abgeschlossenAt ?? doc.beginnAt;
  const maengelSortiert = [...doc.maengel].sort((a, b) => a.sort - b.sort);
  const mangelNr = (m: Mangel) => `M${maengelSortiert.indexOf(m) + 1}`;

  // ── Kopf ──
  function metaPaar(page: PDFPage, top: number, a: [string, string], b: [string, string]) {
    const wB = 98;
    const wA = 82;
    const xB = R - wB;
    const xA = xB - 16 - wA;
    for (const [x, w, [l1, l2]] of [[xA, wA, a], [xB, wB, b]] as [number, number, [string, string]][]) {
      page.drawText(kuerzen(l1, f.regular, 8.5, w), { x, y: top - 8.5, font: f.regular, size: 8.5, color: ink });
      page.drawText(kuerzen(l2, f.regular, 8.5, w), { x, y: top - 20, font: f.regular, size: 8.5, color: ink });
      page.drawLine({ start: { x, y: top - 26 }, end: { x: x + w, y: top - 26 }, thickness: 0.75, color: ink });
    }
  }
  const kopfErste = (page: PDFPage): number => {
    const top = A4.h - M;
    zeichneLogo(page, M, top, 112, ink, brass);
    metaPaar(page, top, [formatDatum(datumDok, doc.sprache), formatDatumZeit(datumDok, doc.sprache).split(", ")[1] ?? ""], [L.kommission, kommissionText]);
    page.drawText(L.protokoll, { x: M, y: top - 102, font: f.light, size: 21, color: ink });
    return top - 118;
  };
  const kopfFolge = (page: PDFPage): number => {
    const top = A4.h - 36;
    zeichneLogo(page, M, top, 78, ink, brass);
    metaPaar(page, top, [L.protokoll, doc.sprache === "en" ? "" : ""], [L.kommission, kommissionText]);
    return top - 50;
  };
  const s = new Seiten(pdf, A4, M, 86, BOTTOM, (page, nr) => (nr === 1 ? kopfErste(page) : kopfFolge(page)));

  // ── Helfer ──
  const breite = (text: string, font: PDFFont, size: number) => font.widthOfTextAtSize(text, size);
  function text(x: number, txt: string, font: PDFFont, size: number, farbe: RGB = ink, dy = size) {
    s.page.drawText(txt, { x, y: s.y - dy, font, size, color: farbe });
  }
  function textRechts(xRechts: number, txt: string, font: PDFFont, size: number, farbe: RGB = ink, dy = size) {
    s.page.drawText(txt, { x: xRechts - breite(txt, font, size), y: s.y - dy, font, size, color: farbe });
  }
  /** Fließtext in einer Spalte mit Seitenumbruch. */
  function zeilen(txt: string, font: PDFFont, size: number, farbe: RGB, x: number, w: number, abstand = 1.4) {
    for (const z of umbrechen(txt, font, size, w)) {
      s.platz(size * abstand);
      if (z) text(x, z, font, size, farbe);
      s.nachUnten(size * abstand);
    }
  }
  function hairline(x1 = M, x2 = R, farbe: RGB = line, dicke = 0.5) {
    s.page.drawLine({ start: { x: x1, y: s.y }, end: { x: x2, y: s.y }, thickness: dicke, color: farbe });
  }
  function caps(x: number, txt: string, farbe: RGB = ink, size = 7.5) {
    text(x, txt.toUpperCase(), f.medium, size, farbe);
  }
  /** Abschnittstitel links mit Unterstrich (Messing oder Ochsenblut); liefert die Höhe. */
  function linkerTitel(titel: string, akzent: RGB, yOben: number, size = 9.5): number {
    const zl = umbrechen(titel, f.medium, size, LW);
    let y = yOben;
    let wMax = 0;
    for (const z of zl) {
      s.page.drawText(z, { x: M, y: y - size, font: f.medium, size, color: akzent === red ? red : ink });
      wMax = Math.max(wMax, breite(z, f.medium, size));
      y -= size * 1.3;
    }
    s.page.drawLine({ start: { x: M, y: y - 2 }, end: { x: M + wMax, y: y - 2 }, thickness: 1.1, color: akzent });
    return yOben - y + 6;
  }
  /** Zwei Spalten: links fester Block (zeichnet ab y, gibt Höhe zurück), rechts fließender Inhalt. */
  async function zweispaltig(minH: number, links: (yOben: number) => number, rechts: () => Promise<void> | void) {
    s.platz(minH);
    const page = s.page;
    const yStart = s.y;
    const hLinks = links(yStart);
    await rechts();
    if (s.page === page) s.y = Math.min(s.y, yStart - hLinks);
  }
  function chip(x: number, yOben: number, st: PruefStatus): number {
    const label = L.status[st];
    const size = 7.5;
    const w = breite(label, f.medium, size) + 10;
    if (st === "mangel") {
      s.page.drawRectangle({ x, y: yOben - 13, width: w, height: 13, color: red });
      s.page.drawText(label, { x: x + 5, y: yOben - 9.5, font: f.medium, size, color: white });
    } else {
      s.page.drawRectangle({ x, y: yOben - 13, width: w, height: 13, borderColor: st === "io" ? ink : muted, borderWidth: 0.6 });
      s.page.drawText(label, { x: x + 5, y: yOben - 9.5, font: f.medium, size, color: st === "io" ? ink : muted });
    }
    return 13;
  }
  async function unterschrift(u: Unterschrift | undefined, x: number, w: number, titel: string) {
    s.platz(64);
    const img = u ? await bild(u.id) : null;
    if (img) {
      const sc = Math.min((w - 10) / img.width, 36 / img.height);
      s.page.drawImage(img, { x, y: s.y - 40, width: img.width * sc, height: img.height * sc });
    }
    s.page.drawLine({ start: { x, y: s.y - 42 }, end: { x: x + w, y: s.y - 42 }, thickness: 0.75, color: ink });
    s.page.drawText(titel.toUpperCase(), { x, y: s.y - 52, font: f.medium, size: 6.8, color: ink });
    const unten = u ? `${u.name} · ${formatDatumZeit(u.zeitpunkt, doc.sprache)}` : L.nein;
    s.page.drawText(kuerzen(unten, f.regular, 8, w), { x, y: s.y - 62, font: f.regular, size: 8, color: u ? muted : red });
  }
  /** Fotos zu einem Mangel. `gross`: erstes Foto groß (2/3), zwei daneben gestapelt, Rest in Dreierreihen. */
  async function fotos(m: Mangel, x: number, w: number, gross: boolean) {
    const liste = doc.fotos.filter((ff) => ff.mangelId === m.id);
    if (!liste.length) return;
    const nr = mangelNr(m);
    const gap = 6;
    const bildIn = async (id: string, bx: number, byOben: number, bw: number, bh: number, label: string) => {
      const img = await bild(id);
      if (img) {
        const sc = Math.min(bw / img.width, bh / img.height);
        const iw = img.width * sc;
        const ih = img.height * sc;
        s.page.drawImage(img, { x: bx + (bw - iw) / 2, y: byOben - bh + (bh - ih) / 2, width: iw, height: ih });
      } else {
        s.page.drawRectangle({ x: bx, y: byOben - bh, width: bw, height: bh, color: line });
      }
      s.page.drawText(label, { x: bx, y: byOben - bh - 9, font: f.mono, size: 6.8, color: muted });
    };
    let i = 0;
    if (gross && liste.length >= 2) {
      const wGross = ((w - gap) * 2) / 3;
      const wKlein = w - gap - wGross;
      const hGross = wGross * 0.75;
      s.platz(hGross + 16);
      const yOben = s.y;
      await bildIn(liste[0].id, x, yOben, wGross, hGross, `${nr}.1`);
      const hKlein = (hGross - gap - 10) / 2;
      if (liste[1]) await bildIn(liste[1].id, x + wGross + gap, yOben, wKlein, hKlein, `${nr}.2`);
      if (liste[2]) await bildIn(liste[2].id, x + wGross + gap, yOben - hKlein - gap - 10, wKlein, hKlein, `${nr}.3`);
      s.nachUnten(hGross + 16);
      i = 3;
    }
    const zelle = (w - 2 * gap) / 3;
    const h = zelle * 0.75;
    for (; i < liste.length; i += 3) {
      s.platz(h + 16);
      const yOben = s.y;
      for (let k = 0; k < 3 && i + k < liste.length; k++) {
        await bildIn(liste[i + k].id, x + k * (zelle + gap), yOben, zelle, h, `${nr}.${i + k + 1}`);
      }
      s.nachUnten(h + 16);
    }
  }
  const mangelTitel = (m: Mangel, p?: Position) => {
    const k = p?.pruefpunkte.find((x) => x.id === m.pruefpunktId);
    const kt = k ? (doc.sprache === "en" && k.textEn ? k.textEn : k.textDe) : "";
    return kt || p?.titel || L.mangel;
  };

  // ── 1. Kunde / Abnahme ──
  {
    const halb = (A4.w - 2 * M - 28) / 2;
    const xB = M + halb + 28;
    const links = [doc.kunde, doc.projekt, doc.titel, doc.ort].filter((x) => x && x.trim());
    const teilnehmer = doc.teilnehmer.map((x) => (x.rolle ? `${x.name} (${x.rolle})` : x.name)).join(", ");
    const rechts = [
      doc.mitarbeiterName ? `${L.mitarbeiter}: ${doc.mitarbeiterName}` : "",
      teilnehmer ? `${L.teilnehmer}: ${teilnehmer}` : "",
      [doc.ort, formatDatumZeit(datumDok, doc.sprache)].filter(Boolean).join(", "),
      doc.version > 1 ? `${L.version} ${doc.version}` : "",
    ].filter(Boolean);
    const yStart = s.y;
    caps(M, L.kunde);
    caps(xB, doc.sprache === "en" ? "Acceptance" : "Abnahme");
    s.nachUnten(12);
    const yInhalt = s.y;
    for (const [i, z] of links.entries()) zeilen(z, i === 0 ? f.medium : f.regular, 9, ink, M, halb, 1.45);
    const yL = s.y;
    s.y = yInhalt;
    for (const z of rechts) zeilen(z, f.regular, 9, ink, xB, halb, 1.45);
    s.y = Math.min(s.y, yL) - 10;
    void yStart;
    hairline(M, R, ink, 0.75);
    s.nachUnten(22);
  }

  // ── 2. Gesamtübersicht ──
  const alle = relevantePositionen(doc);
  await zweispaltig(110, (y) => linkerTitel(`1. ${L.uebersicht}`, brass, y), () => {
    const sp = { pos: RX + 196, io: RX + 226, mangel: RX + 262, nicht: RX + 300, offen: RX + 330 };
    s.platz(16);
    text(RX, L.raum, f.regular, 7.5, muted, 8);
    for (const [x, l] of [[sp.pos, L.nr === "No." ? "Items" : "Pos."], [sp.io, L.io], [sp.mangel, L.mangel], [sp.nicht, doc.sprache === "en" ? "n. t." : "n. pr."], [sp.offen, L.offen]] as [number, string][]) textRechts(x, l, f.regular, 7.5, muted, 8);
    textRechts(R, L.unterschrift, f.regular, 7.5, muted, 8);
    s.nachUnten(12);
    hairline(RX, R, ink, 0.75);
    for (const r of doc.raeume) {
      const fp = fortschritt(relevantePositionen(doc, r.id));
      if (fp.gesamt === 0) continue;
      s.platz(17);
      const sig = Boolean(findeUnterschrift(doc, "raum", r.id));
      text(RX, kuerzen(`${r.etage ? `${r.etage} · ` : ""}${r.name}`, f.regular, 8.8, 180), f.regular, 8.8, ink, 12);
      for (const [x, v, c] of [[sp.pos, fp.gesamt, ink], [sp.io, fp.io, ink], [sp.mangel, fp.mangel, fp.mangel ? red : ink], [sp.nicht, fp.nichtPruefbar, ink], [sp.offen, fp.offen, fp.offen ? red : ink]] as [number, number, RGB][]) {
        textRechts(x, String(v), f.mono, 8.3, c, 12);
      }
      textRechts(R, sig ? L.ja : L.nein, f.regular, 8.5, sig ? ink : red, 12);
      s.nachUnten(17);
      hairline(RX, R);
    }
    const g = fortschritt(alle);
    s.platz(17);
    text(RX, L.gesamt, f.medium, 8.8, ink, 12);
    for (const [x, v, c] of [[sp.pos, g.gesamt, ink], [sp.io, g.io, ink], [sp.mangel, g.mangel, g.mangel ? red : ink], [sp.nicht, g.nichtPruefbar, ink], [sp.offen, g.offen, g.offen ? red : ink]] as [number, number, RGB][]) {
      textRechts(x, String(v), f.mono, 8.3, c, 12);
    }
    s.nachUnten(17);
  });
  s.nachUnten(18);

  // ── 3. Offene Mängel (Kurzfassung) ──
  const offene = maengelSortiert.filter((m) => !m.erledigtAt);
  await zweispaltig(60, (y) => linkerTitel(`2. ${L.offeneMaengel}`, offene.length ? red : brass, y), () => {
    if (!offene.length) {
      zeilen(L.keineMaengel, f.regular, 9, muted, RX, RW);
      return;
    }
    for (const m of offene) {
      const p = doc.positionen.find((x) => x.id === m.positionId);
      const raum = doc.raeume.find((x) => x.id === m.raumId);
      s.platz(30);
      if (m.frist) textRechts(R, `${L.frist} ${formatDatum(m.frist, doc.sprache)}`, f.mono, 8, ink, 9);
      zeilen(`${mangelNr(m)} · ${p ? `${p.nr} ` : ""}${mangelTitel(m, p)}`, f.medium, 9, ink, RX, RW - 100);
      if (raum) zeilen(raum.name, f.regular, 8.5, muted, RX, RW - 100);
      const kurz = umbrechen(m.text, f.regular, 8.5, RW - 100);
      zeilen(kurz.slice(0, 2).join(" ") + (kurz.length > 2 ? " …" : ""), f.regular, 8.5, ink, RX, RW - 100);
      const nF = doc.fotos.filter((x) => x.mangelId === m.id).length;
      if (nF) zeilen(doc.sprache === "en" ? `${nF} photo(s), see list of defects` : `${nF} Foto${nF > 1 ? "s" : ""}, Details in der Mängelliste`, f.regular, 8, muted, RX, RW - 100);
      s.nachUnten(6);
    }
  });

  // ── 4. Räume ──
  async function raumBlock(r: Raum, nrRaum: number, anzahl: number) {
    const ps = doc.positionen.filter((p) => p.raumId === r.id && p.relevant);
    s.platz(220);
    s.nachUnten(18);
    hairline(M, R, ink, 0.75);
    s.nachUnten(10);
    caps(M, `${L.raum} ${nrRaum} ${L.von} ${anzahl}${r.etage ? ` · ${r.etage}` : ""}`);
    s.nachUnten(12);
    zeilen(r.name, f.light, 15, ink, M, A4.w - 2 * M, 1.25);
    s.nachUnten(4);
    if (r.materialText.trim()) {
      await zweispaltig(24, (y) => {
        s.page.drawText(L.materialangaben, { x: M, y: y - 8.5, font: f.regular, size: 8.5, color: muted });
        return 12;
      }, () => zeilen(r.materialText, f.regular, 8.5, ink, RX, RW, 1.4));
    }
    s.nachUnten(8);
    for (const p of ps) await positionBlock(p);
    if (r.bemerkung.trim()) {
      await zweispaltig(24, (y) => {
        s.page.drawText(L.bemerkung, { x: M, y: y - 8.5, font: f.regular, size: 8.5, color: muted });
        return 12;
      }, () => zeilen(r.bemerkung, f.regular, 9, ink, RX, RW));
    }
    s.nachUnten(8);
    await zweispaltig(70, (y) => {
      s.page.drawText(L.unterschriftRaum.toUpperCase(), { x: M, y: y - 44, font: f.medium, size: 7, color: ink });
      return 0;
    }, () => unterschrift(findeUnterschrift(doc, "raum", r.id), RX, Math.min(200, RW), r.name).then(() => s.nachUnten(68)));
  }

  /** Fotos des Objekts (Position), auch bei „i. O.“: in Dreierreihen unter den Prüfpunkten. */
  async function objektFotosBlock(p: Position, x: number, w: number) {
    const liste = (doc.objektFotos ?? []).filter((ff) => ff.positionId === p.id);
    if (!liste.length) return;
    const gap = 6;
    const zelle = (w - 2 * gap) / 3;
    const h = zelle * 0.75;
    s.nachUnten(6);
    for (let i = 0; i < liste.length; i += 3) {
      s.platz(h + 14);
      const yOben = s.y;
      for (let k = 0; k < 3 && i + k < liste.length; k++) {
        const bx = x + k * (zelle + gap);
        const img = await bild(liste[i + k].id);
        if (img) {
          const sc = Math.min(zelle / img.width, h / img.height);
          const iw = img.width * sc;
          const ih = img.height * sc;
          s.page.drawImage(img, { x: bx + (zelle - iw) / 2, y: yOben - h + (h - ih) / 2, width: iw, height: ih });
        } else {
          s.page.drawRectangle({ x: bx, y: yOben - h, width: zelle, height: h, color: line });
        }
        s.page.drawText(`${p.nr} · ${doc.sprache === "en" ? "Photo" : "Foto"} ${i + k + 1}`, { x: bx, y: yOben - h - 9, font: f.mono, size: 6.8, color: muted });
      }
      s.nachUnten(h + 14);
    }
  }

  async function positionBlock(p: Position) {
    const st = positionStatus(p);
    s.nachUnten(8);
    await zweispaltig(70, (y) => {
      const h = linkerTitel(`${p.nr}. ${p.titel}`, st === "mangel" ? red : brass, y, 9);
      let yy = y - h - 4;
      if (p.menge || p.einheit) {
        s.page.drawText(`${L.menge} ${p.menge} ${p.einheit}`.trim(), { x: M, y: yy - 8.5, font: f.regular, size: 8.5, color: muted });
        yy -= 14;
      }
      yy -= chip(M, yy, st) + 2;
      return y - yy;
    }, async () => {
      if (p.langtext.trim()) {
        zeilen(p.langtext, f.regular, 8.3, muted, RX, RW, 1.38);
        s.nachUnten(4);
      }
      if (p.pruefpunkte.length) {
        s.platz(16);
        hairline(RX, R);
        for (const k of p.pruefpunkte) {
          s.platz(16);
          const kt = doc.sprache === "en" && k.textEn ? k.textEn : k.textDe;
          text(RX, kuerzen(kt, f.regular, 9, RW - 90), f.regular, 9, ink, 11.5);
          textRechts(R, L.status[k.status], k.status === "mangel" ? f.medium : f.regular, 9, statusFarbe(k.status), 11.5);
          s.nachUnten(16);
          hairline(RX, R);
        }
      }
      await objektFotosBlock(p, RX, RW);
      for (const m of maengelSortiert.filter((x) => x.positionId === p.id)) {
        s.nachUnten(10);
        s.platz(50);
        const page = s.page;
        const yOben = s.y;
        const xi = RX + 10;
        const wi = RW - 10;
        if (m.frist) textRechts(R, `${L.frist} ${formatDatum(m.frist, doc.sprache)}`, f.mono, 8, ink, 9);
        zeilen(`${mangelNr(m)} · ${L.mangel} · ${mangelTitel(m, p)}`, f.medium, 9, red, xi, wi - 100);
        zeilen(m.text, f.regular, 9, ink, xi, wi);
        if (m.erledigtAt) zeilen(`${L.erledigt}: ${formatDatum(m.erledigtAt, doc.sprache)}`, f.regular, 8.5, green, xi, wi);
        s.nachUnten(4);
        await fotos(m, xi, wi, false);
        const yTop = s.page === page ? yOben : A4.h - 86;
        s.page.drawLine({ start: { x: RX + 0.75, y: yTop }, end: { x: RX + 0.75, y: s.y + 4 }, thickness: 1.5, color: red });
      }
      if (maengelPositionen(doc).some((x) => x.id === p.id)) {
        s.nachUnten(6);
        await unterschrift(findeUnterschrift(doc, "position", p.id), RX, Math.min(200, RW), `${L.unterschriftMangel} · ${p.nr}`);
        s.nachUnten(68);
      }
    });
    s.nachUnten(6);
  }

  const raeumeMit = doc.raeume.filter((r) => doc.positionen.some((p) => p.raumId === r.id && p.relevant));
  for (const [i, r] of raeumeMit.entries()) await raumBlock(r, i + 1, raeumeMit.length);

  // ── 5. Mängelliste mit Fotos ──
  s.neu();
  zeilen(L.maengelliste, f.light, 18, ink, M, A4.w - 2 * M, 1.2);
  s.nachUnten(6);
  hairline(M, R, ink, 0.75);
  s.nachUnten(18);
  if (!maengelSortiert.length) zeilen(L.keineMaengel, f.regular, 9.5, muted, M, A4.w - 2 * M);
  for (const m of maengelSortiert) {
    const p = doc.positionen.find((x) => x.id === m.positionId);
    const raum = doc.raeume.find((x) => x.id === m.raumId);
    await zweispaltig(120, (y) => {
      let h = linkerTitel(`${mangelNr(m)} · ${mangelTitel(m, p)}`, m.erledigtAt ? brass : red, y, 9);
      const kv: [string, string, RGB][] = [
        [L.raum, raum?.name ?? "", ink],
        [L.pos ?? "Pos.", p ? `${p.nr} ${p.titel}` : "", ink],
        [L.frist, m.frist ? formatDatum(m.frist, doc.sprache) : "–", ink],
        [doc.sprache === "en" ? "Status" : "Status", m.erledigtAt ? `${L.erledigt} ${formatDatum(m.erledigtAt, doc.sprache)}` : L.offen, m.erledigtAt ? green : red],
      ];
      h += 4;
      for (const [k, v, c] of kv) {
        if (!v) continue;
        const zl = umbrechen(v, f.regular, 8, LW - 40).slice(0, 3);
        s.page.drawText(k, { x: M, y: y - h - 8, font: f.regular, size: 8, color: muted });
        zl.forEach((z, i) => s.page.drawText(z, { x: M + 40, y: y - h - 8 - i * 10.5, font: f.regular, size: 8, color: c }));
        h += zl.length * 10.5 + 2;
      }
      return h;
    }, async () => {
      zeilen(m.text, f.regular, 9.5, ink, RX, RW);
      s.nachUnten(6);
      await fotos(m, RX, RW, true);
      const pos = p && maengelPositionen(doc).some((x) => x.id === p.id) ? findeUnterschrift(doc, "position", p.id) : undefined;
      await unterschrift(pos, RX, (RW - 20) / 2, L.unterschriftMangel);
      s.nachUnten(68);
    });
    s.nachUnten(16);
    hairline(M, R);
    s.nachUnten(16);
  }

  // ── 6. Schlussunterschriften ──
  s.platz(190);
  await zweispaltig(170, (y) => linkerTitel(L.schluss, brass, y), async () => {
    if (doc.bemerkung.trim()) {
      text(RX, L.gesamtbemerkung, f.regular, 8.5, muted);
      s.nachUnten(12);
      zeilen(doc.bemerkung, f.regular, 9.5, ink, RX, RW);
      s.nachUnten(6);
    }
    text(RX, L.ort_datum, f.regular, 8.5, muted);
    s.nachUnten(12);
    zeilen(`${doc.ort}, ${formatDatumZeit(doc.abgeschlossenAt, doc.sprache)}`, f.regular, 9.5, ink, RX, RW);
    s.nachUnten(12);
    const w = (RW - 20) / 2;
    s.platz(72);
    const y0 = s.y;
    await unterschrift(findeUnterschrift(doc, "schluss_kunde", null), RX, w, L.kundeRolle);
    s.y = y0;
    await unterschrift(findeUnterschrift(doc, "schluss_mitarbeiter", null), RX + w + 20, w, L.mitarbeiterRolle);
    s.nachUnten(70);
  });

  // ── 7. Anhang: nicht Gegenstand der Abnahme ──
  const ausgeblendet = doc.positionen.filter((p) => !p.relevant);
  if (ausgeblendet.length) {
    s.neu();
    zeilen(L.anhang, f.light, 16, ink, M, A4.w - 2 * M, 1.2);
    s.nachUnten(6);
    hairline(M, R, ink, 0.75);
    s.nachUnten(14);
    for (const p of ausgeblendet) {
      const raum = doc.raeume.find((r) => r.id === p.raumId);
      await zweispaltig(40, (y) => {
        const zl = umbrechen(`${p.nr}. ${p.titel}`, f.medium, 8.5, LW);
        zl.forEach((z, i) => s.page.drawText(z, { x: M, y: y - 8.5 - i * 11, font: f.medium, size: 8.5, color: ink }));
        return zl.length * 11 + 4;
      }, () => {
        const meta = [raum?.name, p.menge && p.einheit ? `${p.menge} ${p.einheit}` : p.menge || p.einheit, p.artikel].filter(Boolean).join(" · ");
        if (meta) zeilen(meta, f.regular, 8, muted, RX, RW);
        if (p.langtext.trim()) zeilen(p.langtext, f.regular, 8, ink, RX, RW, 1.35);
      });
      s.nachUnten(8);
      hairline(M, R);
      s.nachUnten(8);
    }
  }

  // ── Fuß aller Seiten ──
  const n = s.pages.length;
  s.pages.forEach((page, i) => {
    page.drawLine({ start: { x: M, y: 48 }, end: { x: R, y: 48 }, thickness: 0.75, color: ink });
    page.drawText(kuerzen(`${hatKomm ? `${L.kommission} ` : ""}${kommissionText} · ${doc.kunde}`, f.regular, 8, A4.w - 2 * M - 90), { x: M, y: 34, font: f.regular, size: 8, color: muted });
    const seite = `${L.seite} ${i + 1} ${L.von} ${n}`;
    page.drawText(seite, { x: R - f.regular.widthOfTextAtSize(seite, 8), y: 34, font: f.regular, size: 8, color: muted });
  });

  return pdf.save();
}
