"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aendereMitarbeiterAction } from "@/app/(app)/abnahme/actions";

/** Durchführenden Mitarbeiter eines nicht abgeschlossenen Protokolls ändern. */
export function MitarbeiterAendern({ id, aktuell, mitarbeiter }: { id: string; aktuell: string; mitarbeiter: { id: string; name: string }[] }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState("");
  const [fehler, setFehler] = useState("");
  const [pending, start] = useTransition();

  function speichern() {
    if (!wahl) return;
    setFehler("");
    start(async () => {
      const r = await aendereMitarbeiterAction(id, wahl);
      if (r.ok) {
        setOffen(false);
        router.refresh();
      } else setFehler(r.error);
    });
  }

  if (!offen) {
    return (
      <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setOffen(true)}>
        Mitarbeiter ändern
      </button>
    );
  }
  return (
    <span className="abn-vorlage-zeile">
      <select className="aus-select" aria-label={`Mitarbeiter (aktuell ${aktuell || "keiner"})`} value={wahl} onChange={(e) => setWahl(e.target.value)}>
        <option value="">Mitarbeiter wählen …</option>
        {mitarbeiter.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button type="button" className="aus-btn aus-btn-primary aus-btn-sm" disabled={pending || !wahl} onClick={speichern}>Speichern</button>
      <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setOffen(false)}>Abbrechen</button>
      {fehler && <span className="aus-field-error" role="alert">{fehler}</span>}
    </span>
  );
}
