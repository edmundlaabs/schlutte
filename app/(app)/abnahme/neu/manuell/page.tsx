import { requireAppAccess } from "@/lib/auth/app-access";
import { getProtokollVorlagen, getVorlagen } from "@/lib/data/abnahme";
import { ProtokollEditor } from "@/components/abnahme/ProtokollEditor";
import type { ProtokollVorlage, Vorlage } from "@/lib/abnahme/types";

export const metadata = { title: "Protokoll erfassen" };

export default async function ManuellPage() {
  const ctx = await requireAppAccess("abnahme");
  let vorlagen: Vorlage[] = [];
  let protokollVorlagen: ProtokollVorlage[] = [];
  let fehler = "";
  try {
    vorlagen = await getVorlagen();
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Vorlagen nicht verfügbar.";
  }
  try {
    protokollVorlagen = await getProtokollVorlagen();
  } catch (e) {
    // Vor der Migration 20261125 gibt es die Tabelle noch nicht: Editor bleibt nutzbar, nur ohne Protokoll-Vorlagen.
    console.warn("Protokoll-Vorlagen:", e instanceof Error ? e.message : e);
  }
  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme · Neues Protokoll</span>
        <h1 className="aus-h1">Protokoll manuell erfassen</h1>
        <p className="aus-lede">
          Kunde und Kommission wählen, dann Räume, Positionen und Prüfpunkte eingeben. Eingaben bleiben auf diesem Gerät
          zwischengespeichert, bis das Protokoll angelegt oder verworfen wird.
        </p>
      </header>
      {fehler && (
        <div className="aus-note is-danger" role="alert">
          <div className="aus-note-body">
            <p>{fehler} Wurde die Migration <code>20261120_abnahme.sql</code> schon ausgeführt?</p>
          </div>
        </div>
      )}
      <ProtokollEditor
        vorlagen={vorlagen}
        protokollVorlagen={protokollVorlagen}
        istAdmin={ctx.isFinance}
        mitarbeiter={{ id: ctx.employee?.id ?? null, name: ctx.employee?.name ?? ctx.email ?? "" }}
        nutzerKey={ctx.employee?.id ?? ctx.userId}
      />
    </>
  );
}
