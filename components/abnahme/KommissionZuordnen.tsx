"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ordneKommissionZu } from "@/app/(app)/abnahme/actions";
import { KundeKommissionAuswahl } from "@/components/abnahme/KundeKommissionAuswahl";
import { LEERE_AUSWAHL, validiereKundeKommission, type KundeKommission } from "@/lib/abnahme/kommission";

/** Protokoll ohne Kommission: Kommission nachträglich zuordnen (bestehend oder neu anlegen). */
export function KommissionZuordnen({ id }: { id: string }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [kk, setKk] = useState<KundeKommission>(LEERE_AUSWAHL);
  const [fehler, setFehler] = useState("");
  const [pending, start] = useTransition();

  // Kunde ist am Protokoll schon vorhanden; geprüft werden nur Nummer bzw. Auswahl.
  const probleme = validiereKundeKommission({ ...kk, kunde: kk.kunde || "x" });

  function zuordnen() {
    if (kk.modus === "ohne") return;
    setFehler("");
    start(async () => {
      const r = await ordneKommissionZu(id, { modus: kk.modus as "bestehend" | "neu", nr: kk.nr });
      if (r.ok) {
        setOffen(false);
        router.refresh();
      } else setFehler(r.error);
    });
  }

  return (
    <section className="aus-card">
      <h2 className="aus-h2">Ohne Kommission</h2>
      <p className="aus-muted">Dieses Protokoll gehört zu keiner Kommission. Eine Kommission lässt sich zuordnen, solange es nicht abgeschlossen ist.</p>
      {!offen && (
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-secondary" onClick={() => { setKk({ ...LEERE_AUSWAHL }); setOffen(true); }}>
            Kommission zuordnen
          </button>
        </div>
      )}
      {offen && (
        <>
          <KundeKommissionAuswahl value={kk} onChange={setKk} modi={["bestehend", "neu"]} mitKunde={false} />
          {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-primary" disabled={pending || probleme.length > 0} onClick={zuordnen}>
              {pending ? "Wird zugeordnet …" : "Zuordnen"}
            </button>
            <button type="button" className="aus-btn aus-btn-quiet" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </>
      )}
    </section>
  );
}
