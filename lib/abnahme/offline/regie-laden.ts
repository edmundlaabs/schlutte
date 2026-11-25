import { rowsToRegie } from "../regie-logic";
import type { RegieDoc } from "../types";
import { holeDokument, speichereDokument } from "./db";

/** Antwort von /api/abnahme/laden (typ regie) lokal ablegen. */
export async function speichereRegieAusServer(res: unknown): Promise<void> {
  const r = res as { row: Record<string, unknown>; zeilen: Record<string, unknown>[] };
  const doc = rowsToRegie(r.row, r.zeilen);
  const vorhanden = await holeDokument(doc.id);
  await speichereDokument({
    id: doc.id, typ: "regie", doc, dirty: false, zustand: "synchronisiert", fehler: "",
    geladenAt: new Date().toISOString(), syncedAt: new Date().toISOString(), versand: vorhanden?.versand ?? [],
    editSeq: (vorhanden?.editSeq ?? 0) + 1,
    basis: JSON.parse(JSON.stringify(doc)) as RegieDoc, konflikt: null, archiv: null,
  });
}

/** Blob-ID der Kundenunterschrift eines Regieberichts. */
export const regieSignaturBlobId = (docId: string) => `${docId}-sig`;

export function regiePfadeSetzen(doc: RegieDoc, gesetzt: Map<string, string>): RegieDoc {
  return {
    ...doc,
    unterschriftPath: gesetzt.get(regieSignaturBlobId(doc.id)) ?? doc.unterschriftPath,
    pdfPath: gesetzt.get(`pdf:${doc.id}`) ?? doc.pdfPath,
  };
}
