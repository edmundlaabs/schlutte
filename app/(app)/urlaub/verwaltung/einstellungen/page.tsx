import { listArbeitsmuster, listBetriebsferien, listKonfliktpaare, listMitarbeiter, listSperren } from "@/lib/data/urlaub";
import { fehlerText } from "@/lib/urlaub/fehler";
import {
  ArbeitsmusterEinstellung,
  BetriebsferienEinstellung,
  KonfliktpaareEinstellung,
  SperrenEinstellung,
} from "@/components/urlaub/EinstellungenForms";

export const metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  let daten;
  try {
    const [personen, paare, sperren, ferien, muster] = await Promise.all([
      listMitarbeiter(), listKonfliktpaare(), listSperren(), listBetriebsferien(), listArbeitsmuster(),
    ]);
    daten = { personen, paare, sperren, ferien, muster };
  } catch (e) {
    return <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehlerText(e)}</p></div></div>;
  }
  const personen = [...daten.personen].sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub · Verwaltung</span>
        <h1 className="aus-h1">Einstellungen</h1>
      </header>
      <section className="aus-section"><div className="aus-section-head"><h2 className="aus-h2">Betriebsferien</h2></div><BetriebsferienEinstellung ferien={daten.ferien} /></section>
      <section className="aus-section"><div className="aus-section-head"><h2 className="aus-h2">Urlaubssperren</h2></div><SperrenEinstellung sperren={daten.sperren} /></section>
      <section className="aus-section"><div className="aus-section-head"><h2 className="aus-h2">Konfliktpaare</h2></div><KonfliktpaareEinstellung paare={daten.paare} personen={personen} /></section>
      <section className="aus-section"><div className="aus-section-head"><h2 className="aus-h2">Arbeitsmuster</h2></div><ArbeitsmusterEinstellung muster={daten.muster} personen={personen} /></section>
    </>
  );
}
