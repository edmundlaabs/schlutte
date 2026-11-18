import Link from "next/link";
import { listAntraege, listBetriebsferien, listKonfliktpaare, listMitarbeiter, listSperren } from "@/lib/data/urlaub";
import { MonatsRaster, type RasterEintrag, type RasterZeile } from "@/components/urlaub/MonatsRaster";
import { findeKonflikte, hatKonflikt } from "@/lib/urlaub/konflikte";
import { heuteISO, monatsName, tageText, zeitraumText } from "@/lib/urlaub/datum";
import { fehlerText } from "@/lib/urlaub/fehler";
import { AKTIVE_STATUS, ART_LABEL, STATUS_LABEL } from "@/lib/urlaub/types";

export const metadata = { title: "Teamkalender" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const heute = heuteISO();
  const m = (await searchParams).m;
  const treffer = m && /^(\d{4})-(\d{2})$/.exec(m);
  let jahr = Number(heute.slice(0, 4));
  let monat = Number(heute.slice(5, 7)) - 1;
  if (treffer && Number(treffer[2]) >= 1 && Number(treffer[2]) <= 12) { jahr = Number(treffer[1]); monat = Number(treffer[2]) - 1; }
  const link = (j: number, mo: number) => `/urlaub/verwaltung/team?m=${j}-${String(mo + 1).padStart(2, "0")}`;
  const vorher = monat === 0 ? link(jahr - 1, 11) : link(jahr, monat - 1);
  const nachher = monat === 11 ? link(jahr + 1, 0) : link(jahr, monat + 1);

  let daten;
  try {
    const [antraege, mitarbeiter, paare, sperren, ferien] = await Promise.all([
      listAntraege(), listMitarbeiter(), listKonfliktpaare(), listSperren(), listBetriebsferien(),
    ]);
    daten = { antraege, mitarbeiter, paare, sperren, ferien };
  } catch (e) {
    return <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehlerText(e)}</p></div></div>;
  }
  const { antraege, mitarbeiter, paare, sperren, ferien } = daten;

  const zeilen: RasterZeile[] = [];
  if (ferien.length) {
    zeilen.push({ key: "ferien", label: "Betriebsferien", eintraege: ferien.map((f): RasterEintrag => ({ von: f.von, bis: f.bis, typ: "ferien", label: f.titel, titel: `Betriebsferien: ${f.titel}` })) });
  }
  if (sperren.length) {
    zeilen.push({ key: "sperren", label: "Urlaubssperre", eintraege: sperren.map((s): RasterEintrag => ({ von: s.von, bis: s.bis, typ: "sperre", label: s.titel, titel: `Urlaubssperre: ${s.titel}` })) });
  }
  for (const ma of [...mitarbeiter].sort((a, b) => a.name.localeCompare(b.name, "de"))) {
    const eintraege = antraege
      .filter((a) => a.employee_id === ma.id && AKTIVE_STATUS.includes(a.status))
      .map((a): RasterEintrag => ({
        von: a.von,
        bis: a.bis,
        typ: "eigen",
        status: a.status === "beantragt" ? "beantragt" : "genehmigt",
        halbStart: a.halbtag_start,
        halbEnde: a.halbtag_ende,
        konflikt: hatKonflikt(findeKonflikte(a, antraege, paare, sperren)),
        label: a.art === "urlaub" ? "" : ART_LABEL[a.art],
        titel: `${ma.name} · ${ART_LABEL[a.art]} · ${zeitraumText(a.von, a.bis)} · ${tageText(a.tage)} Tage · ${STATUS_LABEL[a.status]}`,
        href: `/urlaub/verwaltung/antrag/${a.id}`,
      }));
    zeilen.push({ key: ma.id, label: ma.name, eintraege });
  }

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Urlaub · Verwaltung</span>
        <h1 className="aus-h1">Teamkalender</h1>
      </header>
      <section className="aus-section">
        <div className="urlaub-steuerung">
          <div className="urlaub-monatswahl">
            <Link href={vorher} className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Vorheriger Monat">‹</Link>
            <strong>{monatsName(monat)} {jahr}</strong>
            <Link href={nachher} className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Nächster Monat">›</Link>
          </div>
          <Link href="/urlaub/verwaltung/team" className="aus-btn aus-btn-quiet aus-btn-sm">Heute</Link>
        </div>
        <ul className="urlaub-legende">
          <li><i /> Genehmigt</li>
          <li><i className="l-beantragt" /> Beantragt</li>
          <li><i className="l-konflikt" /> Konflikt</li>
          <li><i className="l-ferien" /> Betriebsferien</li>
          <li><i className="l-sperre" /> Urlaubssperre</li>
        </ul>
        <div className="urlaub-monat is-aktuell" style={{ display: "block" }}>
          <MonatsRaster jahr={jahr} monat={monat} zeilen={zeilen} ferien={ferien} sperren={sperren} heute={heute} />
        </div>
        <p className="aus-help" style={{ marginTop: 8 }}>Klick auf einen Eintrag öffnet den Antrag mit Protokoll.</p>
      </section>
    </>
  );
}
