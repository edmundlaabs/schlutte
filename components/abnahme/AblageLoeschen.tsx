"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loescheProtokollAction, loescheRegieAction } from "@/app/(app)/abnahme/actions";

/** „Löschen“ direkt in der Ablage (Protokoll inkl. Nachträgen bzw. Regiebericht), nach Rückfrage. */
export function AblageLoeschen({ typ, id, abgeschlossen, bezeichnung }: { typ: "abnahme" | "regie"; id: string; abgeschlossen: boolean; bezeichnung: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fehler, setFehler] = useState("");

  function loeschen() {
    const was = typ === "regie" ? "Regiebericht" : "Abnahmeprotokoll";
    const sicher = abgeschlossen ? `Diesen ABGESCHLOSSENEN (unterschriebenen) ${was} endgültig löschen?` : `Diesen ${was} endgültig löschen?`;
    if (!window.confirm(`${sicher}\n\n${bezeichnung}\n\nAlle zugehörigen Daten, Fotos, Unterschriften, PDFs und das Versandprotokoll werden gelöscht${typ === "abnahme" ? " (auch Nachträge)" : ""}. Das lässt sich nicht rückgängig machen.`)) return;
    setFehler("");
    start(async () => {
      const r = typ === "regie" ? await loescheRegieAction(id) : await loescheProtokollAction(id);
      if (r.ok) router.refresh();
      else setFehler(r.error);
    });
  }

  return (
    <>
      <button type="button" className="abn-eintrag-loeschen" disabled={pending} onClick={loeschen}>
        {pending ? "Löscht …" : "Löschen"}
      </button>
      {fehler && <span className="aus-field-error" role="alert">{fehler}</span>}
    </>
  );
}
