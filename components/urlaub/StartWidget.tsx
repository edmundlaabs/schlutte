import Link from "next/link";
import type { StartWidgetDaten } from "@/lib/data/urlaub";
import { tageText, zeitraumText } from "@/lib/urlaub/datum";
import { ART_LABEL, STATUS_LABEL } from "@/lib/urlaub/types";

/** Startseiten-Block: Resturlaub, offene eigene Anträge, nächste Abwesenheit; für Admin/CEO zusätzlich der Zähler. */
export function StartWidget({ daten }: { daten: StartWidgetDaten }) {
  return (
    <div className="sch-block" aria-label="Urlaub">
      <div className="sch-block-head">
        <div>
          <span className="sch-eyebrow">Urlaub</span>
          <h2>{tageText(daten.rest)} Tage Resturlaub {daten.jahr}</h2>
        </div>
        <Link href="/urlaub">Zum Urlaub →</Link>
      </div>
      {daten.offeneGesamt !== null && daten.offeneGesamt > 0 && (
        <p className="sch-block-empty">
          <Link href="/urlaub/verwaltung" style={{ color: "var(--accent)" }}>
            {daten.offeneGesamt} {daten.offeneGesamt === 1 ? "offener Antrag wartet" : "offene Anträge warten"} auf Entscheidung →
          </Link>
        </p>
      )}
      <p className="sch-block-empty">
        {daten.naechste
          ? <>Nächste Abwesenheit: {zeitraumText(daten.naechste.von, daten.naechste.bis)} ({ART_LABEL[daten.naechste.art]})</>
          : "Keine genehmigte Abwesenheit geplant."}
      </p>
      {daten.offeneEigene.length > 0 && (
        <div className="sch-claims-list">
          {daten.offeneEigene.map((a) => (
            <Link key={a.id} href="/urlaub" className="sch-claim-row">
              <span className="sch-claim-name">{zeitraumText(a.von, a.bis)}</span>
              <span>{tageText(a.tage)} {a.tage === 1 ? "Tag" : "Tage"}</span>
              <strong>{STATUS_LABEL[a.status]}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
