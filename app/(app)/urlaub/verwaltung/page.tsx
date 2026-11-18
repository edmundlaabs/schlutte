import Link from "next/link";
import {
  listAntraege,
  listArbeitsmuster,
  listBetriebsferien,
  listKonfliktpaare,
  listKontingente,
  listMitarbeiter,
  listSperren,
} from "@/lib/data/urlaub";
import { berechneKonto, restNachEntscheidung } from "@/lib/urlaub/konto";
import { findeKonflikte, hatKonflikt } from "@/lib/urlaub/konflikte";
import { heuteISO, tageText, zeitraumText } from "@/lib/urlaub/datum";
import { fehlerText } from "@/lib/urlaub/fehler";
import { ART_LABEL, STATUS_LABEL } from "@/lib/urlaub/types";
import { AntragAktionen } from "@/components/urlaub/AntragAktionen";

export const metadata = { title: "Eingang" };

export default async function EingangPage() {
  let daten;
  try {
    const [antraege, mitarbeiter, paare, sperren, kontingente, muster, ferien] = await Promise.all([
      listAntraege(), listMitarbeiter(), listKonfliktpaare(), listSperren(), listKontingente(), listArbeitsmuster(), listBetriebsferien(),
    ]);
    daten = { antraege, mitarbeiter, paare, sperren, kontingente, muster, ferien };
  } catch (e) {
    return (
      <>
        <header className="aus-head"><span className="aus-eyebrow">Urlaub · Verwaltung</span><h1 className="aus-h1">Eingang</h1></header>
        <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehlerText(e)}</p></div></div>
      </>
    );
  }
  const { antraege, mitarbeiter, paare, sperren, kontingente, muster, ferien } = daten;
  const name = (id: string) => mitarbeiter.find((m) => m.id === id)?.name ?? "Unbekannt";
  const heute = heuteISO();

  const offen = antraege
    .filter((a) => a.status === "beantragt" || a.status === "storno_beantragt")
    .sort((a, b) => a.von.localeCompare(b.von));
  const entschieden = antraege.filter((a) => !["beantragt", "storno_beantragt"].includes(a.status))
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 15);

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub · Verwaltung</span>
        <h1 className="aus-h1">Eingang</h1>
        <p className="aus-lede">Offene Anträge und Stornoanträge. Konflikte sind nur ein Hinweis – du kannst trotzdem genehmigen.</p>
      </header>

      <section className="aus-section" aria-label="Offene Anträge">
        {offen.length === 0 ? (
          <div className="aus-empty"><p className="aus-empty-title">Nichts zu entscheiden</p></div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {offen.map((a) => {
              const jahr = Number(a.von.slice(0, 4));
              const eigene = antraege.filter((x) => x.employee_id === a.employee_id);
              const restNach = a.art === "urlaub"
                ? restNachEntscheidung(
                    {
                      jahr,
                      kontingent: kontingente.find((k) => k.employee_id === a.employee_id && k.jahr === jahr) ?? null,
                      antraege: eigene,
                      muster: muster.filter((m) => m.employee_id === a.employee_id),
                      betriebsferien: ferien,
                      heute,
                    },
                    a.id,
                    a.status === "storno_beantragt" ? "storniert" : "genehmigt",
                  )
                : null;
              const konto = a.art === "urlaub"
                ? berechneKonto({
                    jahr, kontingent: kontingente.find((k) => k.employee_id === a.employee_id && k.jahr === jahr) ?? null,
                    antraege: eigene, muster: muster.filter((m) => m.employee_id === a.employee_id), betriebsferien: ferien, heute,
                  })
                : null;
              const konflikt = findeKonflikte(a, antraege, paare, sperren);
              return (
                <li key={a.id} className="urlaub-zeile">
                  <div className="urlaub-zeile-kopf">
                    <div>
                      <div className="urlaub-zeile-titel">
                        <Link href={`/urlaub/verwaltung/antrag/${a.id}`}>{name(a.employee_id)}</Link> · {zeitraumText(a.von, a.bis)}
                      </div>
                      <div className="urlaub-zeile-meta">
                        {ART_LABEL[a.art]} · {tageText(a.tage)} {a.tage === 1 ? "Tag" : "Tage"}
                        {a.halbtag_start && " · erster Tag halb"}{a.halbtag_ende && " · letzter Tag halb"}
                      </div>
                      {a.kommentar && <div className="urlaub-zeile-meta">„{a.kommentar}“</div>}
                      {konto && restNach !== null && (
                        <div className="urlaub-zeile-meta">
                          Rest {jahr} jetzt {tageText(konto.rest)} → {a.status === "storno_beantragt" ? "nach Storno" : "nach Genehmigung"} <strong>{tageText(restNach)}</strong>
                          {restNach < 0 && " (Konto überzogen)"}
                        </div>
                      )}
                      {hatKonflikt(konflikt) && (
                        <div className="urlaub-konflikte">
                          {konflikt.paare.map((p) => (
                            <span key={p.antragId} className="urlaub-badge" title="Konfliktpaar: dürfen nicht gleichzeitig abwesend sein">
                              Konflikt mit {name(p.partnerId)}
                            </span>
                          ))}
                          {konflikt.sperren.map((s) => <span key={s.id} className="urlaub-badge" title="Urlaubssperre">Sperre: {s.titel}</span>)}
                        </div>
                      )}
                    </div>
                    <span className="aus-chip">{STATUS_LABEL[a.status]}</span>
                  </div>
                  <AntragAktionen id={a.id} status={a.status as "beantragt" | "storno_beantragt"} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {entschieden.length > 0 && (
        <section className="aus-section" aria-labelledby="u-entschieden">
          <div className="aus-section-head"><h2 id="u-entschieden" className="aus-h2">Zuletzt entschieden</h2></div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {entschieden.map((a) => (
              <li key={a.id} className="urlaub-zeile">
                <div className="urlaub-zeile-kopf">
                  <div>
                    <div className="urlaub-zeile-titel"><Link href={`/urlaub/verwaltung/antrag/${a.id}`}>{name(a.employee_id)}</Link> · {zeitraumText(a.von, a.bis)}</div>
                    <div className="urlaub-zeile-meta">{ART_LABEL[a.art]} · {tageText(a.tage)} Tage</div>
                  </div>
                  <span className={`aus-chip urlaub-chip-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
