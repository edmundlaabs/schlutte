import type { ProtokollDoc, Sprache } from "./types.ts";

/**
 * Kunde und Kommission eines Protokolls (Auswahl im Import und im manuellen Editor).
 * - bestehend: Kommission aus commissions gewählt (commissionId gesetzt)
 * - neu: Kommission wird erst beim Speichern des Protokolls angelegt
 * - ohne: Kleinauftrag ohne Kommissionsnummer (nur Kunde Pflicht)
 */
export type KommissionModus = "bestehend" | "neu" | "ohne";

export type KundeKommission = {
  modus: KommissionModus;
  commissionId: string | null;
  nr: string;
  kunde: string;
  projekt: string;
};

export const LEERE_AUSWAHL: KundeKommission = { modus: "bestehend", commissionId: null, nr: "", kunde: "", projekt: "" };

/** Ein Protokoll hat eine Kommission, wenn eine Nummer eingetragen ist (leer = ohne Kommission). */
export function hatKommission(doc: { kommissionNr: string }): boolean {
  return doc.kommissionNr.trim() !== "";
}

/** Anzeigetext der Kommission: Nummer oder „ohne Kommission“. */
export function kommissionAnzeige(nr: string | null | undefined, sprache: Sprache = "de"): string {
  const n = (nr ?? "").trim();
  return n || (sprache === "en" ? "no commission" : "ohne Kommission");
}

/** Nummer ist gültig, wenn sie genau 6 Ziffern hat (wie createCommission). */
export const KOMMISSION_FORMAT = /^\d{6}$/;

/** Probleme der Auswahl (leer = gültig). */
export function validiereKundeKommission(kk: KundeKommission): string[] {
  const probleme: string[] = [];
  const nr = kk.nr.trim();
  if (!kk.kunde.trim()) probleme.push("Kundenname fehlt.");
  if (kk.modus === "bestehend") {
    if (!nr || !kk.commissionId) probleme.push("Bitte eine bestehende Kommission wählen, eine neue anlegen oder „ohne Kommission“ wählen.");
  } else if (kk.modus === "neu") {
    if (!nr) probleme.push("Kommissionsnummer fehlt.");
    else if (!KOMMISSION_FORMAT.test(nr)) probleme.push("Die Kommissionsnummer muss genau 6 Ziffern haben.");
  }
  return probleme;
}

/** Überträgt die Auswahl in die Kopffelder des Protokolls. */
export function wendeAuswahlAn(doc: ProtokollDoc, kk: KundeKommission): ProtokollDoc {
  const ohne = kk.modus === "ohne";
  return {
    ...doc,
    commissionId: ohne || kk.modus === "neu" ? null : kk.commissionId,
    kommissionNr: ohne ? "" : kk.nr.trim(),
    kunde: kk.kunde.trim(),
    projekt: kk.projekt.trim(),
  };
}

/** Auswahl aus einem vorhandenen Protokoll (z. B. Profacto-Import vor der Suche). */
export function auswahlAusDoc(doc: Pick<ProtokollDoc, "commissionId" | "kommissionNr" | "kunde" | "projekt">): KundeKommission {
  const nr = doc.kommissionNr.trim();
  return {
    modus: nr ? (doc.commissionId ? "bestehend" : "neu") : "ohne",
    commissionId: doc.commissionId,
    nr,
    kunde: doc.kunde,
    projekt: doc.projekt,
  };
}
