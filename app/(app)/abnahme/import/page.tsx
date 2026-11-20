import { requireAppAccess } from "@/lib/auth/app-access";
import { getVorlagen } from "@/lib/data/abnahme";
import { ImportWizard } from "@/components/abnahme/ImportWizard";
import type { Vorlage } from "@/lib/abnahme/types";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const ctx = await requireAppAccess("abnahme");
  let vorlagen: Vorlage[] = [];
  let fehler = "";
  try {
    vorlagen = await getVorlagen();
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Vorlagen nicht verfügbar.";
  }
  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme</span>
        <h1 className="aus-h1">Positionsliste importieren</h1>
        <p className="aus-lede">
          Profacto-PDF „Einfache Positionsliste“ hochladen, Räume und Prüfpunkte prüfen, dann als
          Abnahmeprotokoll für die Baustelle anlegen.
        </p>
      </header>
      {fehler && (
        <div className="aus-note is-danger" role="alert">
          <div className="aus-note-body">
            <p>{fehler} Wurde die Migration <code>20261120_abnahme.sql</code> schon ausgeführt?</p>
          </div>
        </div>
      )}
      <ImportWizard
        vorlagen={vorlagen}
        mitarbeiter={{ id: ctx.employee?.id ?? null, name: ctx.employee?.name ?? ctx.email ?? "" }}
      />
    </>
  );
}
