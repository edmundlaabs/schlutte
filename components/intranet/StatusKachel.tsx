import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { UpcomingItem } from "@/lib/types";
import type { StartWidgetDaten } from "@/lib/data/urlaub";
import { tageText, zeitraumText } from "@/lib/urlaub/datum";

export type AuslagenStatus = {
  /** Nur CEO/Admin: eingereichte Anträge. */
  isAdmin: boolean;
  offen: number;
};

function Zelle({ titel, href, children }: { titel: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="sch-status-cell">
      {href ? <Link href={href} className="sch-status-title">{titel} →</Link> : <span className="sch-status-title">{titel}</span>}
      {children}
    </div>
  );
}

function Liste({ items, leer }: { items: UpcomingItem[]; leer: string }) {
  if (items.length === 0) return <p className="sch-status-muted">{leer}</p>;
  return (
    <ul className="sch-status-list">
      {items.slice(0, 2).map((it) => (
        <li key={it.id}>
          <span className="sch-status-main">{it.text}</span>
          <span className="sch-status-sub">{it.dateLabel} · {it.daysLabel}</span>
        </li>
      ))}
    </ul>
  );
}

/** Eine kompakte Status-Kachel für alle: Geburtstage, Events, Auslagen, Urlaub. */
export function StatusKachel({
  birthdays,
  events,
  auslagen,
  urlaub,
  urlaubOffen,
}: {
  birthdays: UpcomingItem[];
  events: UpcomingItem[];
  /** null = Auslagen nicht freigeschaltet (Zelle entfällt). */
  auslagen: AuslagenStatus | null;
  /** null = Urlaub nicht freigeschaltet/nicht live (Zelle entfällt). */
  urlaub: StartWidgetDaten | null;
  /** Offene Urlaubsanträge (nur CEO/Admin ungleich 0), Anzeige über Badge. */
  urlaubOffen: number;
}) {
  return (
    <section className="sch-status" aria-label="Status">
      <Zelle titel="Geburtstage"><Liste items={birthdays} leer="Keine hinterlegt." /></Zelle>
      <Zelle titel="Events"><Liste items={events} leer="Keine anstehenden." /></Zelle>

      {auslagen && (
        <Zelle titel="Auslagen" href={auslagen.isAdmin ? "/auslagen/eingang" : "/auslagen"}>
          {auslagen.isAdmin ? (
            auslagen.offen > 0 ? (
              <p className="sch-status-main">
                {auslagen.offen} {auslagen.offen === 1 ? "Antrag" : "Anträge"} offen
                <Badge count={auslagen.offen} kind="auslagen" />
              </p>
            ) : <p className="sch-status-muted">Nichts zu erledigen.</p>
          ) : (
            <p className="sch-status-muted">Nichts zu erledigen.</p>
          )}
        </Zelle>
      )}

      {urlaub && (
        <Zelle titel="Urlaub" href={urlaubOffen > 0 ? "/urlaub/verwaltung" : "/urlaub"}>
          <p className="sch-status-main">{tageText(urlaub.rest)} Tage Rest</p>
          {urlaubOffen > 0 && (
            <p className="sch-status-sub">
              {urlaubOffen === 1 ? "Antrag wartet" : "Anträge warten"}
              <Badge count={urlaubOffen} kind="urlaub" />
            </p>
          )}
          {urlaub.offeneEigene.length > 0 ? (
            <p className="sch-status-sub">{urlaub.offeneEigene.length} eigene{urlaub.offeneEigene.length === 1 ? "r" : ""} offen</p>
          ) : urlaub.naechste ? (
            <p className="sch-status-sub">Nächste: {zeitraumText(urlaub.naechste.von, urlaub.naechste.bis)}</p>
          ) : (
            <p className="sch-status-sub">Nichts geplant</p>
          )}
        </Zelle>
      )}
    </section>
  );
}
