/** Welche Datei für welchen Zweck: neue Fotos haben Varianten, alte (z. B. Wagener) nur `path` (1600 px). */
export type FotoMitPfaden = { path: string | null; pathOriginal?: string | null; pathThumb?: string | null };

/** Raster: Vorschau, sonst die 1600-px-Datei. */
export const pfadVorschau = (f: FotoMitPfaden): string | null => f.pathThumb || f.path || null;
/** Lightbox: Original, sonst die 1600-px-Datei. */
export const pfadOriginal = (f: FotoMitPfaden): string | null => f.pathOriginal || f.path || null;
/** PDF und Begehung: immer die 1600-px-Datei. */
export const pfadPdf = (f: FotoMitPfaden): string | null => f.path || null;
