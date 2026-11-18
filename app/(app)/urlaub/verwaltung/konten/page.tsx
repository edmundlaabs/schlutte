import Link from "next/link";
import { listAntraege, listArbeitsmuster, listBetriebsferien, listKontingente, listMitarbeiter } from "@/lib/data/urlaub";
import { berechneKonto } from "@/lib/urlaub/konto";
import { heuteISO } from "@/lib/urlaub/datum";
import { fehlerText } from "@/lib/urlaub/fehler";
import { KontoZeile } from "@/components/urlaub/KontoZeile";

export const metadata = { title: "Konten" };

export default async function KontenPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  const heute = heuteISO();
  const aktuell = Number(heute.slice(0, 4));
  const gewuenscht = Number((await searchParams).jahr);
  const jahr = Number.isInteger(gewuenscht) && Math.abs(gewuenscht - aktuell) <= 3 ? gewuenscht : aktuell;

  let daten;
  try {
    const [mitarbeiter, kontingente, antraege, muster, ferien] = await Promise.all([
      listMitarbeiter(), listKontingente(), listAntraege(), listArbeitsmuster(), listBetriebsferien(),
    ]);
    daten = { mitarbeiter, kontingente, antraege, muster, ferien };
  } catch (e) {
    return <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehlerText(e)}</p></div></div>;
  }
  const { mitarbeiter, kontingente, antraege, muster, ferien } = daten;

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub · Verwaltung</span>
        <h1 className="aus-h1">Konten {jahr}</h1>
        <p className="aus-lede">
          Anspruch, Übertrag und Korrektur pflegst du hier. „Übertrag aus Vorjahr“ übernimmt den Rest des Vorjahres zum 31.12.
          Nicht genommener Übertrag verfällt zum eingetragenen Datum (Standard 31.03.). Rest = Anspruch + Übertrag + Korrektur − genommen − geplant.
        </p>
        <div className="aus-filters" aria-label="Jahr">
          {[jahr - 1, jahr, jahr + 1].map((j) => (
            <Link key={j} href={`/urlaub/verwaltung/konten?jahr=${j}`} className={`aus-filter${j === jahr ? " is-active" : ""}`}>{j}</Link>
          ))}
        </div>
      </header>
      <section className="aus-section">
        <div className="urlaub-tabelle-wrap">
          <table className="urlaub-tabelle">
            <thead>
              <tr>
                <th>Mitarbeiter</th><th>Anspruch</th><th>Übertrag / Verfall</th><th>Korrektur</th>
                <th>Genommen</th><th>Geplant</th><th>Beantragt</th><th>Rest</th><th />
              </tr>
            </thead>
            <tbody>
              {[...mitarbeiter].sort((a, b) => a.name.localeCompare(b.name, "de")).map((ma) => {
                const k = kontingente.find((x) => x.employee_id === ma.id && x.jahr === jahr) ?? null;
                const konto = berechneKonto({
                  jahr,
                  kontingent: k,
                  antraege: antraege.filter((a) => a.employee_id === ma.id),
                  muster: muster.filter((m) => m.employee_id === ma.id),
                  betriebsferien: ferien,
                  heute,
                });
                return <KontoZeile key={`${ma.id}-${jahr}-${k?.anspruch}-${k?.uebertrag}-${k?.korrektur}`} employeeId={ma.id} name={ma.name} konto={konto} notiz={k?.korrektur_notiz ?? ""} />;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
