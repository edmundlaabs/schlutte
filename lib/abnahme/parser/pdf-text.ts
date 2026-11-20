import type { PdfPage } from "./types.ts";
import { parseProfactoPages } from "./profacto.ts";

/**
 * Minimale Sicht auf pdfjs-dist, damit dieselbe Extraktion im Browser (pdfjs-dist)
 * und im Test (pdfjs-dist/legacy) läuft. Die Library selbst wird vom Aufrufer übergeben.
 */
type PdfjsLike = {
  getDocument: (src: { data: Uint8Array; useSystemFonts?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { height: number };
        getTextContent: () => Promise<{ items: unknown[]; styles: Record<string, unknown> }>;
        getOperatorList: () => Promise<unknown>;
        commonObjs: { get: (name: string) => { bold?: boolean; name?: string; loadedName?: string } };
      }>;
      destroy?: () => Promise<void>;
    }>;
  };
};

export async function extractPdfPages(data: Uint8Array, pdfjs: PdfjsLike): Promise<PdfPage[]> {
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    // Schriftobjekte werden erst beim Auswerten der Operatorliste aufgelöst.
    await page.getOperatorList();
    const boldFonts = new Map<string, boolean>();
    for (const fontName of Object.keys(content.styles)) {
      try {
        const f = page.commonObjs.get(fontName);
        boldFonts.set(fontName, Boolean(f.bold) || /bold|black|heavy/i.test(`${f.name ?? ""} ${f.loadedName ?? ""}`));
      } catch {
        boldFonts.set(fontName, false);
      }
    }
    const items = (content.items as { str?: string; transform?: number[]; fontName?: string }[])
      .filter((it) => typeof it.str === "string" && it.transform)
      .map((it) => ({
        str: it.str as string,
        x: it.transform![4],
        y: height - it.transform![5],
        bold: boldFonts.get(it.fontName ?? "") ?? false,
      }));
    pages.push({ height, items });
  }
  await doc.destroy?.();
  return pages;
}

export async function parseProfactoPdf(data: Uint8Array, pdfjs: PdfjsLike) {
  return parseProfactoPages(await extractPdfPages(data, pdfjs));
}
