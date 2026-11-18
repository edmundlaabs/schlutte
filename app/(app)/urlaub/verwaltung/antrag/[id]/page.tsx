import Link from "next/link";
import { notFound } from "next/navigation";
import { getAntrag, listAntraege, listKonfliktpaare, listMitarbeiter, listProtokoll, listSperren } from "@/lib/data/urlaub";
import { findeKonflikte, hatKonflikt } from "@/lib/urlaub/konflikte";
import { tageText, zeitraumText } from "@/lib/urlaub/datum";
import { ART_LABEL, STATUS_LABEL } from "@/lib/urlaub/types";
import { formatDateTime } from "@/lib/utils";
import { AntragAktionen } from "@/components/urlaub/AntragAktionen";

export const metadata = { title: "Antrag" };

const AKTION_TEXT: Record<string, string> = {
  beantragt: "Beantragt",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
  zurueckgezogen: "Zurückgezogen",
  storno_beantragt: "Storno beantragt",
  storniert: "Storniert",
  storno_abgelehnt: "Storno abgelehnt",
};

export default async function AntragDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const antrag = await getAntrag(id);
  if (!antrag) notFound();
  const [alle, paare, sperren, mitarbeiter, protokoll] = await Promise.all([
    listAntraege(), listKonfliktpaare(), listSperren(), listMitarbeiter(), listProtokoll(id),
  ]);
  const name = (eid: string | null) => mitarbeiter.find((m) => m.id === eid)?.name ?? "—";
  const konflikt = findeKonflikte(antrag, alle, paare, sperren);

  return (
    <>
      <header className="aus-head">
        <Link href="/urlaub/verwaltung" className="aus-back">← Eingang</Link>
        <span className="aus-eyebrow">Urlaub · Antrag</span>
        <h1 className="aus-h1">{name(antrag.employee_id)}</h1>
        <p className="aus-lede">
          {zeitraumText(antrag.von, antrag.bis)} · {ART_LABEL[antrag.art]} · {tageText(antrag.tage)} {antrag.tage === 1 ? "Tag" : "Tage"} ·{" "}
          <span className={`aus-chip urlaub-chip-${antrag.status}`}>{STATUS_LABEL[antrag.status]}</span>
        </p>
        {antrag.kommentar && <p className="aus-help">Kommentar: „{antrag.kommentar}“</p>}
        {antrag.begruendung && <p className="aus-help">Begründung: {antrag.begruendung}</p>}
        {hatKonflikt(konflikt) && (
          <div className="urlaub-konflikte">
            {konflikt.paare.map((p) => <span key={p.antragId} className="urlaub-badge">Konflikt mit {name(p.partnerId)}</span>)}
            {konflikt.sperren.map((s) => <span key={s.id} className="urlaub-badge">Sperre: {s.titel}</span>)}
          </div>
        )}
      </header>

      {(antrag.status === "beantragt" || antrag.status === "storno_beantragt") && (
        <section className="aus-section"><AntragAktionen id={antrag.id} status={antrag.status} /></section>
      )}

      <section className="aus-section" aria-labelledby="u-protokoll">
        <div className="aus-section-head"><h2 id="u-protokoll" className="aus-h2">Protokoll</h2></div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {protokoll.map((p) => (
            <li key={p.id} className="urlaub-zeile">
              <div className="urlaub-zeile-titel">{AKTION_TEXT[p.aktion] ?? p.aktion}</div>
              <div className="urlaub-zeile-meta">{formatDateTime(p.created_at)} · {name(p.von_employee)}{p.notiz ? ` · „${p.notiz}“` : ""}</div>
            </li>
          ))}
          {protokoll.length === 0 && <li className="aus-help">Keine Einträge.</li>}
        </ul>
      </section>
    </>
  );
}
