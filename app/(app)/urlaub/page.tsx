import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/roles";
import { hasAdminRights } from "@/lib/auth/app-role";
import {
  listAntraege,
  listArbeitsmuster,
  listBetriebsferien,
  listKontingente,
  listSperren,
  teamKalender,
  zaehleOffene,
} from "@/lib/data/urlaub";
import { berechneKonto } from "@/lib/urlaub/konto";
import { heuteISO } from "@/lib/urlaub/datum";
import { fehlerText } from "@/lib/urlaub/fehler";
import { KontoKopf } from "@/components/urlaub/KontoKopf";
import { AntragForm } from "@/components/urlaub/AntragForm";
import { JahresKalender } from "@/components/urlaub/JahresKalender";
import { MeineAntraege } from "@/components/urlaub/MeineAntraege";

export default async function UrlaubPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login?next=/urlaub");

  const heute = heuteISO();
  const aktuellesJahr = Number(heute.slice(0, 4));
  const gewuenscht = Number((await searchParams).jahr);
  const jahr = Number.isInteger(gewuenscht) && Math.abs(gewuenscht - aktuellesJahr) <= 2 ? gewuenscht : aktuellesJahr;
  const employeeId = ctx.employee?.id;

  if (!employeeId) {
    return (
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub &amp; Abwesenheit</span>
        <h1 className="aus-h1">Urlaub</h1>
        <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>Für dein Konto gibt es keinen Mitarbeiter-Eintrag. Bitte an einen Administrator wenden.</p></div></div>
      </header>
    );
  }

  let fehler: string | null = null;
  let daten;
  try {
    const [antraege, kontingente, muster, ferien, sperren, team, offene] = await Promise.all([
      listAntraege(employeeId),
      listKontingente(employeeId),
      listArbeitsmuster(employeeId),
      listBetriebsferien(),
      listSperren(),
      teamKalender(`${jahr}-01-01`, `${jahr}-12-31`),
      hasAdminRights(ctx.role) ? zaehleOffene() : Promise.resolve(0),
    ]);
    daten = { antraege, kontingente, muster, ferien, sperren, team, offene };
  } catch (e) {
    fehler = fehlerText(e);
  }

  const kopf = (
    <header className="aus-head">
      <span className="aus-eyebrow">Urlaub &amp; Abwesenheit</span>
      <h1 className="aus-h1">Urlaub</h1>
    </header>
  );
  if (!daten) {
    return (
      <>
        {kopf}
        <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehler}</p></div></div>
      </>
    );
  }

  const { antraege, kontingente, muster, ferien, sperren, team, offene } = daten;
  const konto = berechneKonto({
    jahr,
    kontingent: kontingente.find((k) => k.jahr === jahr) ?? null,
    antraege,
    muster,
    betriebsferien: ferien,
    heute,
  });
  const meine = antraege.filter((a) => a.von.slice(0, 4) === String(jahr) || a.bis.slice(0, 4) === String(jahr));

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub &amp; Abwesenheit</span>
        <h1 className="aus-h1">Urlaub</h1>
        <div className="aus-filters" aria-label="Jahr">
          {[jahr - 1, jahr, jahr + 1].map((j) => (
            <Link key={j} href={j === aktuellesJahr ? "/urlaub" : `/urlaub?jahr=${j}`} className={`aus-filter${j === jahr ? " is-active" : ""}`} aria-current={j === jahr ? "page" : undefined}>{j}</Link>
          ))}
        </div>
      </header>

      {hasAdminRights(ctx.role) && offene > 0 && (
        <div className="aus-note" role="status">
          <div className="aus-note-body"><p><Link href="/urlaub/verwaltung">{offene} {offene === 1 ? "offener Antrag wartet" : "offene Anträge warten"} auf dich →</Link></p></div>
        </div>
      )}

      <section className="aus-section"><KontoKopf konto={konto} /></section>

      <section className="aus-section" aria-label="Antrag stellen">
        <AntragForm muster={muster} ferien={ferien} sperren={sperren} restNachBeantragt={konto.restNachBeantragt} />
      </section>

      <section className="aus-section" aria-labelledby="u-kalender">
        <div className="aus-section-head"><h2 id="u-kalender" className="aus-h2">Kalender {jahr}</h2></div>
        <JahresKalender
          jahr={jahr}
          heute={heute}
          eigene={antraege.map((a) => ({ von: a.von, bis: a.bis, art: a.art, status: a.status, halbtag_start: a.halbtag_start, halbtag_ende: a.halbtag_ende }))}
          kollegen={team.filter((t) => !t.ist_eigen)}
          ferien={ferien}
          sperren={sperren}
        />
      </section>

      <section className="aus-section" aria-labelledby="u-antraege">
        <div className="aus-section-head"><h2 id="u-antraege" className="aus-h2">Meine Anträge</h2></div>
        <MeineAntraege antraege={meine} />
      </section>
    </>
  );
}
