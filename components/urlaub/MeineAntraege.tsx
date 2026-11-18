"use client";

import { stornoBeantragenAction, zurueckziehenAction } from "@/app/(app)/urlaub/actions";
import { Meldung, useAktion } from "./useAktion";
import { tageText, zeitraumText } from "@/lib/urlaub/datum";
import { ART_LABEL, STATUS_LABEL, type Antrag } from "@/lib/urlaub/types";

function Zeile({ antrag }: { antrag: Antrag }) {
  const { pending, result, ausfuehren } = useAktion();
  const zaehlt = antrag.art === "urlaub";
  return (
    <li className="urlaub-zeile">
      <div className="urlaub-zeile-kopf">
        <div>
          <div className="urlaub-zeile-titel">{zeitraumText(antrag.von, antrag.bis)}</div>
          <div className="urlaub-zeile-meta">
            {ART_LABEL[antrag.art]} · {tageText(antrag.tage)} {antrag.tage === 1 ? "Tag" : "Tage"}
            {!zaehlt && " (zählt nicht gegen das Konto)"}
            {antrag.halbtag_start && " · erster Tag halb"}
            {antrag.halbtag_ende && " · letzter Tag halb"}
          </div>
          {antrag.kommentar && <div className="urlaub-zeile-meta">„{antrag.kommentar}“</div>}
          {antrag.status === "abgelehnt" && antrag.begruendung && <div className="urlaub-zeile-meta">Begründung: {antrag.begruendung}</div>}
        </div>
        <span className={`aus-chip urlaub-chip-${antrag.status}`}>{STATUS_LABEL[antrag.status]}</span>
      </div>
      {antrag.status === "beantragt" && (
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending}
            onClick={() => ausfuehren(() => zurueckziehenAction(antrag.id))}>Zurückziehen</button>
        </div>
      )}
      {antrag.status === "genehmigt" && antrag.bis >= new Date().toISOString().slice(0, 10) && (
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending}
            onClick={() => { if (confirm("Storno für diesen genehmigten Urlaub beantragen?")) ausfuehren(() => stornoBeantragenAction(antrag.id)); }}>Storno beantragen</button>
        </div>
      )}
      {antrag.status === "storno_beantragt" && <p className="aus-help">Storno wartet auf die Entscheidung der Geschäftsleitung.</p>}
      <Meldung result={result} />
    </li>
  );
}

export function MeineAntraege({ antraege }: { antraege: Antrag[] }) {
  if (antraege.length === 0) {
    return (
      <div className="aus-empty">
        <p className="aus-empty-title">Noch keine Anträge</p>
        <p className="aus-help">Mit „Urlaub beantragen“ legst du den ersten an.</p>
      </div>
    );
  }
  return <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{antraege.map((a) => <Zeile key={a.id} antrag={a} />)}</ul>;
}
