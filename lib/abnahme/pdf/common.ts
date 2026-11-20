import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** Farben wie in den bestehenden Schlutte-PDFs (lib/auslagen/pdf) und styles/tokens.css. */
export const ink = rgb(0.055, 0.055, 0.051);
export const muted = rgb(0.42, 0.42, 0.4);
export const brass = rgb(0.65, 0.51, 0.29);
export const red = rgb(0.69, 0.18, 0.18);
export const green = rgb(0.25, 0.5, 0.25);
export const faint = rgb(0.93, 0.92, 0.9);

export type Fonts = { regular: PDFFont; light: PDFFont; medium: PDFFont };
export type FontLoader = (name: string) => Promise<ArrayBuffer | Uint8Array>;

export async function ladeFonts(pdf: PDFDocument, loader: FontLoader): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const [regular, light, medium] = await Promise.all(
    ["1-IBMPlexSans-Regular.ttf", "1-IBMPlexSans-Light.ttf", "1-IBMPlexSans-Medium.ttf"].map(async (n) =>
      pdf.embedFont(await loader(n), { subset: true })
    )
  );
  return { regular, light, medium };
}

export const A4 = { w: 595.28, h: 841.89 };
export const A4_QUER = { w: 841.89, h: 595.28 };

/** Zeilenumbruch nach Wortgrenzen; harte Umbrüche (\n) bleiben; überlange Wörter werden getrennt. */
export function umbrechen(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const absatz of text.replace(/\r/g, "").split("\n")) {
    if (absatz.trim() === "") {
      out.push("");
      continue;
    }
    let zeile = "";
    for (const wort of absatz.split(/\s+/).filter(Boolean)) {
      let w = wort;
      while (font.widthOfTextAtSize(w, size) > maxWidth) {
        let n = w.length - 1;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxWidth) n--;
        if (zeile) {
          out.push(zeile);
          zeile = "";
        }
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      const probe = zeile ? `${zeile} ${w}` : w;
      if (font.widthOfTextAtSize(probe, size) <= maxWidth) zeile = probe;
      else {
        out.push(zeile);
        zeile = w;
      }
    }
    if (zeile) out.push(zeile);
  }
  return out;
}

export function kuerzen(text: string, font: PDFFont, size: number, width: number): string {
  let v = text;
  while (v.length > 1 && font.widthOfTextAtSize(v, size) > width) v = v.slice(0, -2) + "…";
  return v;
}

/** Seitenverwaltung mit Cursor; Kopf/Fuß der Seiten werden im Aufrufer gezeichnet. */
export class Seiten {
  pdf: PDFDocument;
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;
  readonly margin: number;
  private size: { w: number; h: number };
  private top: number;
  private bottom: number;
  private onNew: (page: PDFPage, nr: number) => number;
  constructor(
    pdf: PDFDocument,
    size: { w: number; h: number },
    margin: number,
    top: number,
    bottom: number,
    onNew: (page: PDFPage, nr: number) => number
  ) {
    this.pdf = pdf;
    this.size = size;
    this.margin = margin;
    this.top = top;
    this.bottom = bottom;
    this.onNew = onNew;
    this.neu();
  }
  get width() {
    return this.size.w - 2 * this.margin;
  }
  neu() {
    this.page = this.pdf.addPage([this.size.w, this.size.h]);
    this.pages.push(this.page);
    this.y = this.onNew(this.page, this.pages.length) ?? this.size.h - this.top;
  }
  /** Platz für h pt sicherstellen, sonst neue Seite. */
  platz(h: number) {
    if (this.y - h < this.bottom) this.neu();
  }
  nachUnten(h: number) {
    this.y -= h;
  }
}

export async function bettePng(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}
export async function betteJpg(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
