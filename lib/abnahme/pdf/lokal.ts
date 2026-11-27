import { blobsDesDokuments, holeBlob, speichereBlob } from "../offline/db";
import type { ProtokollDoc } from "../types";
import { erzeugeProtokollPdf, type PdfBild } from "./protokoll";

/** Rendert das Logo (SVG, aus dem Service-Worker-Cache auch offline) einmal als PNG für pdf-lib. */
export async function ladeLogoPng(): Promise<Uint8Array | null> {
  try {
    const svg = await (await fetch("/brand/grabner-schlutte-logo.svg")).blob();
    const url = URL.createObjectURL(svg);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Logo nicht ladbar"));
      img.src = url;
    });
    const w = 1200;
    const h = Math.round((w * 155.3) / 566.93);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function fontLoaderBrowser(name: string): Promise<ArrayBuffer> {
  const r = await fetch(`/fonts/${name}`);
  if (!r.ok) throw new Error("PDF-Schrift konnte nicht geladen werden.");
  return r.arrayBuffer();
}

/** Erzeugt das Protokoll-PDF aus den lokalen Daten (ohne Netz) und gibt die Bytes zurück. */
export async function erzeugeProtokollPdfLokal(doc: ProtokollDoc): Promise<Uint8Array> {
  const bilder = new Map<string, PdfBild>();
  for (const b of await blobsDesDokuments(doc.id)) {
    if (b.art !== "foto" && b.art !== "unterschrift") continue; // nur Bilder in PDF-Größe, nie Originale
    bilder.set(b.id, { bytes: new Uint8Array(await b.blob.arrayBuffer()), mime: b.mime });
  }
  // QR-Code für den Online-Link (qrcode läuft ohne Netz; Chunk wird mit der Begehungs-Shell vorgehalten).
  let qrPng: Uint8Array | null = null;
  if (doc.publicToken) {
    try {
      const { erzeugeQrPng } = await import("./qr");
      const { publicUrl } = await import("../public-token");
      qrPng = await erzeugeQrPng(publicUrl(doc.publicToken));
    } catch {
      qrPng = null; // PDF entsteht trotzdem, der Link steht im Klartext
    }
  }
  return erzeugeProtokollPdf(doc, { fonts: fontLoaderBrowser, bilder, logoPng: await ladeLogoPng(), qrPng });
}

/** Beim Abschluss: PDF erzeugen und als Blob `pdf:<id>` ablegen; der Sync lädt es hoch. */
export async function speicherePdfLokal(doc: ProtokollDoc): Promise<void> {
  const bytes = await erzeugeProtokollPdfLokal(doc);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  await speichereBlob({ id: `pdf:${doc.id}`, docId: doc.id, art: "pdf", mime: "application/pdf", blob, hochgeladen: false });
}

export async function holePdfBlob(docId: string): Promise<Blob | null> {
  return (await holeBlob(`pdf:${docId}`))?.blob ?? null;
}

// ── Regiebericht ──
import type { RegieDoc } from "../types";
import { erzeugeRegiePdf } from "./regie";

export async function erzeugeRegiePdfLokal(doc: RegieDoc): Promise<Uint8Array> {
  const bilder = new Map<string, PdfBild>();
  for (const b of await blobsDesDokuments(doc.id)) {
    if (b.art !== "foto" && b.art !== "unterschrift") continue; // nur Bilder in PDF-Größe, nie Originale
    bilder.set(b.id, { bytes: new Uint8Array(await b.blob.arrayBuffer()), mime: b.mime });
  }
  return erzeugeRegiePdf(doc, { fonts: fontLoaderBrowser, bilder, logoPng: await ladeLogoPng() });
}

export async function speichereRegiePdfLokal(doc: RegieDoc): Promise<void> {
  const bytes = await erzeugeRegiePdfLokal(doc);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  await speichereBlob({ id: `pdf:${doc.id}`, docId: doc.id, art: "pdf", mime: "application/pdf", blob, hochgeladen: false });
}
