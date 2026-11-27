/** Verkleinert ein Foto lokal auf höchstens maxPx (lange Kante) und liefert JPEG. EXIF-Ausrichtung wird übernommen. */
export async function komprimiereFoto(file: Blob, maxPx = 1600, qualitaet = 0.8): Promise<{ blob: Blob; breite: number; hoehe: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const breite = Math.round(bitmap.width * scale);
  const hoehe = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close?.();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto konnte nicht umgewandelt werden."))), "image/jpeg", qualitaet)
  );
  return { blob, breite, hoehe };
}

/** iOS-Safari begrenzt Canvas-Flächen (ca. 16,7 MP). Wir bleiben knapp darunter. */
export const MAX_CANVAS_PIXEL = 16_000_000;

/** Skaliert (breite × höhe) proportional so, dass die Fläche höchstens `maxPixel` beträgt; nie hochskalieren. */
export function begrenzeAufPixel(breite: number, hoehe: number, maxPixel = MAX_CANVAS_PIXEL): { breite: number; hoehe: number } {
  const flaeche = breite * hoehe;
  if (flaeche <= maxPixel) return { breite, hoehe };
  const f = Math.sqrt(maxPixel / flaeche);
  return { breite: Math.floor(breite * f), hoehe: Math.floor(hoehe * f) };
}

/** Faktor für „lange Kante ≤ maxPx“ (höchstens 1). */
export function skalaFuerLangeKante(breite: number, hoehe: number, maxPx: number): number {
  return Math.min(1, maxPx / Math.max(breite, hoehe));
}

export type FotoVarianten = {
  /** 1600 px (lange Kante): für PDF und Begehungs-Anzeige, wie bisher. */
  pdf: { blob: Blob; breite: number; hoehe: number };
  /** ca. 600 px für das Raster der Online-Seite. */
  thumb: Blob;
  /** Volle Auflösung: JPEG-Datei unverändert, sonst JPEG in voller Auflösung (max. ~16 MP). */
  original: Blob;
};

async function canvasJpeg(bitmap: ImageBitmap, breite: number, hoehe: number, qualitaet: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto konnte nicht umgewandelt werden."))), "image/jpeg", qualitaet)
  );
  // Canvas-Speicher sofort freigeben (iOS hält ihn sonst lange).
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/**
 * Erzeugt aus einer Aufnahme drei Varianten (original, pdf, thumb). Das Bild wird einmal dekodiert (EXIF-Ausrichtung
 * wird übernommen). Ein JPEG-Original bleibt byte-identisch (EXIF bleibt erhalten); HEIC/andere werden als JPEG in
 * voller Auflösung abgelegt.
 */
export async function erzeugeFotoVarianten(file: Blob): Promise<FotoVarianten> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sPdf = skalaFuerLangeKante(bitmap.width, bitmap.height, 1600);
    const pdfB = Math.round(bitmap.width * sPdf);
    const pdfH = Math.round(bitmap.height * sPdf);
    const pdfBlob = await canvasJpeg(bitmap, pdfB, pdfH, 0.8);

    const sThumb = skalaFuerLangeKante(bitmap.width, bitmap.height, 600);
    const thumb = await canvasJpeg(bitmap, Math.round(bitmap.width * sThumb), Math.round(bitmap.height * sThumb), 0.75);

    let original: Blob;
    if (file.type === "image/jpeg") {
      original = file;
    } else {
      const g = begrenzeAufPixel(bitmap.width, bitmap.height);
      original = await canvasJpeg(bitmap, g.breite, g.hoehe, 0.92);
    }
    return { pdf: { blob: pdfBlob, breite: pdfB, hoehe: pdfH }, thumb, original };
  } finally {
    bitmap.close?.();
  }
}
