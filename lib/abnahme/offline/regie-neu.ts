import { neuesRegieDoc } from "../regie-logic";
import type { RegieDoc, Sprache } from "../types";
import { geraeteId, getMeta, speichereDokument } from "./db";
import { istOnline } from "./sync";

const heute = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Legt einen Regiebericht lokal an (auch offline). Kommission und Kunde sind Pflicht.
 * Mit Internet wird der Kopf aus commissions bzw. dem letzten Dokument der Kommission vorbefüllt.
 */
export async function legeRegieLokalAn(a: { kommissionNr: string; kunde: string; sprache: Sprache }): Promise<string> {
  const me = (await getMeta<{ id: string | null; name: string }>("me")) ?? { id: null, name: "" };
  let vorbelegung: Partial<RegieDoc> = {};
  if (istOnline()) {
    try {
      const res = await fetch(`/api/abnahme/kommission?nr=${encodeURIComponent(a.kommissionNr.trim())}`);
      if (res.ok && !res.redirected) {
        const j = await res.json();
        vorbelegung = { commissionId: j.commissionId, name: j.name, strasse: j.strasse, ort: j.ort, telefon: j.telefon, kundeEmail: j.kundeEmail };
      }
    } catch {
      /* offline: leer lassen */
    }
  }
  const doc = neuesRegieDoc({
    kommissionNr: a.kommissionNr, kunde: a.kunde, sprache: a.sprache, mitarbeiterId: me.id, mitarbeiterName: me.name, heute: heute(), vorbelegung,
  });
  await geraeteId();
  await speichereDokument({
    id: doc.id, typ: "regie", doc, dirty: true, zustand: "lokal", fehler: "", geladenAt: new Date().toISOString(), syncedAt: null, versand: [], editSeq: 1,
  });
  return doc.id;
}
