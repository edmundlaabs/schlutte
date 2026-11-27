import type { LokalesDokument } from "./offline/db";
import type { ProtokollDoc } from "./types";
import { erzeugePublicToken } from "./public-token";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

/**
 * Schließt ein Protokoll ab: Zeitstempel setzen, PDF lokal erzeugen und ablegen (auch offline),
 * dann sperren. Der Sync lädt Daten und PDF hoch und stößt den Versand an.
 */
export async function schliesseProtokollAb(
  doc: ProtokollDoc,
  aendere: (fn: (d: ProtokollDoc) => ProtokollDoc) => void,
  aendereEintrag: (fn: (e: Abnahme) => Abnahme) => void
): Promise<void> {
  const jetzt = new Date().toISOString();
  // Der Token entsteht hier auf dem Gerät: das PDF (QR/Link) wird offline erzeugt und braucht ihn sofort.
  const geschlossen: ProtokollDoc = {
    ...doc,
    status: "abgeschlossen",
    abgeschlossenAt: jetzt,
    publicToken: doc.publicToken ?? erzeugePublicToken(),
    publicAktiv: true,
    publicErstelltAt: doc.publicToken ? doc.publicErstelltAt ?? jetzt : jetzt,
  };
  const { speicherePdfLokal } = await import("./pdf/lokal");
  await speicherePdfLokal(geschlossen);
  aendere(() => geschlossen);
  // Automatischer Versand nach dem Sync, falls bei Abschluss eine Kunden-E-Mail angegeben wurde.
  if (geschlossen.kundeEmail.trim()) {
    aendereEintrag((e) => ({
      ...e,
      versand: [...e.versand, { an: geschlossen.kundeEmail.trim(), kopie: geschlossen.kopieEmail.trim(), schluessel: `abschluss:${geschlossen.id}:v${geschlossen.version}` }],
    }));
  }
}
