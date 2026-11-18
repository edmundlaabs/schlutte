"use client";

import { useState } from "react";
import { entscheidenAction, type Entscheidung } from "@/app/(app)/urlaub/actions";
import { Meldung, useAktion } from "./useAktion";

/** Entscheidungs-Buttons für einen offenen Antrag bzw. Stornoantrag. */
export function AntragAktionen({ id, status }: { id: string; status: "beantragt" | "storno_beantragt" }) {
  const { pending, result, ausfuehren } = useAktion();
  const [ablehnen, setAblehnen] = useState(false);
  const [text, setText] = useState("");

  const los = (e: Entscheidung) => ausfuehren(() => entscheidenAction(id, e, text), () => { setAblehnen(false); setText(""); });
  const istStorno = status === "storno_beantragt";

  return (
    <div className="aus-stack">
      {!ablehnen ? (
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-primary aus-btn-sm" disabled={pending}
            onClick={() => los(istStorno ? "storno_bestaetigen" : "genehmigen")}>
            {istStorno ? "Storno bestätigen" : "Genehmigen"}
          </button>
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending} onClick={() => setAblehnen(true)}>
            {istStorno ? "Storno ablehnen" : "Ablehnen"}
          </button>
        </div>
      ) : (
        <div className="urlaub-inline-form">
          <div className="aus-field">
            <label className="aus-label" htmlFor={`b-${id}`}>Begründung{!istStorno && <span className="aus-req">*</span>}</label>
            <input id={`b-${id}`} className="aus-input" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <button type="button" className="aus-btn aus-btn-danger aus-btn-sm" disabled={pending || (!istStorno && !text.trim())}
            onClick={() => los(istStorno ? "storno_ablehnen" : "ablehnen")}>
            {istStorno ? "Storno ablehnen" : "Ablehnen"}
          </button>
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setAblehnen(false)}>Zurück</button>
        </div>
      )}
      <Meldung result={result} />
    </div>
  );
}
