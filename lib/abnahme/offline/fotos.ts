import { blobsDesDokuments, holeDokument, loescheBlob, originalId, speichereBlob, speichereDokument, thumbId, type LokalerBlob } from "./db";
import { erzeugeFotoVarianten, type FotoVarianten } from "./images";
import type { ProtokollDoc } from "../types";

export const FOTO_EVENT = "abnahme-originale";
const melde = () => typeof window !== "undefined" && window.dispatchEvent(new Event(FOTO_EVENT));

export type NeueFotoDaten = { breite: number; hoehe: number; blob: Blob; thumb: Blob; original: Blob };

/** Aufnahme in drei Varianten umwandeln (noch nichts speichern; der Mangel-Dialog speichert beim Sichern). */
export async function verarbeiteFoto(file: File): Promise<NeueFotoDaten> {
  const v: FotoVarianten = await erzeugeFotoVarianten(file);
  return { blob: v.pdf.blob, breite: v.pdf.breite, hoehe: v.pdf.hoehe, thumb: v.thumb, original: v.original };
}

/** Legt alle drei Blobs eines Fotos lokal ab (nicht hochgeladen). Fehlt thumb/original (alter Aufrufer), wird nur pdf gespeichert. */
export async function speichereFotoBlobs(docId: string, fotoId: string, d: { blob: Blob; thumb?: Blob; original?: Blob }): Promise<void> {
  await speichereBlob({ id: fotoId, docId, art: "foto", mime: "image/jpeg", blob: d.blob, hochgeladen: false });
  if (d.thumb) await speichereBlob({ id: thumbId(fotoId), docId, art: "thumb", mime: "image/jpeg", blob: d.thumb, hochgeladen: false });
  if (d.original) await speichereBlob({ id: originalId(fotoId), docId, art: "original", mime: "image/jpeg", blob: d.original, hochgeladen: false });
}

export const originalPfad = (docId: string, fotoId: string) => `protokoll/${docId}/fotos/${fotoId}.orig.jpg`;
export const thumbPfad = (docId: string, fotoId: string) => `protokoll/${docId}/fotos/${fotoId}.thumb.jpg`;

export async function ausstehendeOriginale(docId: string): Promise<LokalerBlob[]> {
  return (await blobsDesDokuments(docId)).filter((b) => b.art === "original" && !b.hochgeladen);
}

export type OriginaleStatus = { gesamt: number; offen: number };

/** Status „Originale: 12 / 18 hochgeladen“: gesamt = alle lokal bekannten Originale dieses Dokuments (hochgeladene werden gelöscht, zählen daher über `bereit`). */
export async function originaleOffen(docId: string): Promise<number> {
  return (await ausstehendeOriginale(docId)).length;
}

/** Ist für das Dokument noch ein Original lokal offen (Schutz vor „Vom Gerät entfernen“)? */
export async function hatOffeneOriginale(docId: string): Promise<boolean> {
  return (await originaleOffen(docId)) > 0;
}

function fotoArt(doc: ProtokollDoc, fotoId: string): "foto" | "objekt" | null {
  if (doc.fotos.some((f) => f.id === fotoId)) return "foto";
  if ((doc.objektFotos ?? []).some((f) => f.id === fotoId)) return "objekt";
  return null;
}

/**
 * Lädt die Originale eines synchronisierten Dokuments einzeln hoch (abbruchsicher: je Foto Upload → Server trägt den Pfad
 * ein → lokaler Blob wird freigegeben; bricht es ab, bleibt das Original lokal und kommt beim nächsten Sync dran).
 * `supabase` = Browser-Client. Rückgabe: Anzahl hochgeladen / Fehlertext.
 */
export async function ladeOriginaleHoch(
  supabase: { storage: { from: (b: string) => { upload: (p: string, b: Blob, o: { contentType?: string; upsert: boolean }) => Promise<{ error: { message: string } | null }> } } },
  docId: string,
  fortschritt?: (erledigt: number, gesamt: number) => void
): Promise<{ hochgeladen: number; fehler: string }> {
  if (laeuft.has(docId)) return { hochgeladen: 0, fehler: "" };
  laeuft.add(docId);
  try {
    return await ladeOriginaleHochIntern(supabase, docId, fortschritt);
  } finally {
    laeuft.delete(docId);
    melde();
  }
}

const laeuft = new Set<string>();

async function ladeOriginaleHochIntern(
  supabase: Parameters<typeof ladeOriginaleHoch>[0],
  docId: string,
  fortschritt?: (erledigt: number, gesamt: number) => void
): Promise<{ hochgeladen: number; fehler: string }> {
  const offen = await ausstehendeOriginale(docId);
  let hochgeladen = 0;
  let fehler = "";
  for (const [i, b] of offen.entries()) {
    const fotoId = b.id.replace(/:orig$/, "");
    const e = await holeDokument(docId);
    if (!e || e.typ !== "abnahme") break;
    const art = fotoArt(e.doc, fotoId);
    if (!art) {
      // Das Foto wurde inzwischen gelöscht: Original ist überflüssig.
      await loescheBlob(b.id);
      continue;
    }
    const pfad = originalPfad(docId, fotoId);
    const up = await supabase.storage.from("abnahme").upload(pfad, b.blob, { contentType: b.mime || "image/jpeg", upsert: true });
    if (up.error) {
      fehler = `Original-Upload: ${up.error.message}`;
      break;
    }
    try {
      const res = await fetch("/api/abnahme/original", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protokollId: docId, fotoId, art, pfad }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        fehler = json.error ?? `Fehler ${res.status}`;
        break;
      }
    } catch {
      fehler = "Keine Verbindung.";
      break;
    }
    // Lokal: Pfad in Dokument und Basis nachtragen (ohne „dirty“ zu setzen) und Original freigeben.
    const cur = await holeDokument(docId);
    if (cur && cur.typ === "abnahme") {
      const setze = (d: ProtokollDoc): ProtokollDoc => ({
        ...d,
        fotos: d.fotos.map((f) => (f.id === fotoId ? { ...f, pathOriginal: pfad } : f)),
        objektFotos: (d.objektFotos ?? []).map((f) => (f.id === fotoId ? { ...f, pathOriginal: pfad } : f)),
      });
      await speichereDokument({ ...cur, doc: setze(cur.doc), basis: cur.basis ? setze(cur.basis) : cur.basis });
    }
    await loescheBlob(b.id);
    hochgeladen++;
    fortschritt?.(i + 1, offen.length);
    melde();
  }
  melde();
  return { hochgeladen, fehler };
}
