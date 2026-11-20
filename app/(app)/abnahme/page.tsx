import Link from "next/link";
import { listAblage } from "@/lib/data/abnahme";
import { formatDatum } from "@/lib/abnahme/i18n";

export const metadata = { title: "Ablage" };

type SP = { q?: string; typ?: string; status?: string; mitarbeiter?: string; von?: string; bis?: string };

export default async function AblagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let eintraege: Awaited<ReturnType<typeof listAblage>> = [];
  let fehler = "";
  try {
    eintraege = await listAblage(sp);
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Ablage nicht verfügbar.";
  }
  const hatFilter = Object.values(sp).some(Boolean);

  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme</span>
        <h1 className="aus-h1">Ablage</h1>
        <p className="aus-lede">Abnahmeprotokolle und Regieberichte. Mit offenen Mängeln markierte Protokolle brauchen einen Nachtrag.</p>
        <div className="aus-head-actions">
          <Link className="aus-btn aus-btn-primary" href="/abnahme/import">PDF importieren</Link>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme/begehung">Begehung</Link>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme/regie">Regiebericht</Link>
        </div>
      </header>

      <form className="aus-filters abn-filter" method="get">
        <input className="aus-input" name="q" placeholder="Kommission oder Kunde" defaultValue={sp.q ?? ""} aria-label="Suche" />
        <select className="aus-select" name="typ" defaultValue={sp.typ ?? ""} aria-label="Typ">
          <option value="">Alle Typen</option>
          <option value="abnahme">Abnahmeprotokoll</option>
          <option value="regie">Regiebericht</option>
        </select>
        <select className="aus-select" name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Alle Status</option>
          <option value="bereit">bereit</option>
          <option value="in_arbeit">in Arbeit</option>
          <option value="abgeschlossen">abgeschlossen</option>
        </select>
        <input className="aus-input" name="mitarbeiter" placeholder="Mitarbeiter" defaultValue={sp.mitarbeiter ?? ""} aria-label="Mitarbeiter" />
        <input className="aus-input" type="date" name="von" defaultValue={sp.von ?? ""} aria-label="Von" />
        <input className="aus-input" type="date" name="bis" defaultValue={sp.bis ?? ""} aria-label="Bis" />
        <button className="aus-btn aus-btn-secondary" type="submit">Filtern</button>
        {hatFilter && <Link className="aus-btn aus-btn-quiet" href="/abnahme">Zurücksetzen</Link>}
      </form>

      {fehler && (
        <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehler} Wurde die Migration <code>20261120_abnahme.sql</code> ausgeführt?</p></div></div>
      )}
      {!fehler && eintraege.length === 0 && <p className="aus-muted">Keine Dokumente gefunden.</p>}

      <ul className="aus-list abn-ablage">
        {eintraege.map((e) => (
          <li key={`${e.typ}-${e.id}`} className="aus-item">
            <div className="aus-item-main">
              <Link className="aus-item-title" href={e.typ === "abnahme" ? `/abnahme/protokoll/${e.id}` : `/abnahme/regie/ansicht/${e.id}`}>
                {e.typ === "abnahme" ? "Abnahmeprotokoll" : "Regiebericht"} · {e.kommission_nr} · {e.kunde}
              </Link>
              <div className="aus-item-meta">
                {e.titel && <>{e.titel} · </>}{e.projekt && <>{e.projekt} · </>}{formatDatum(e.datum, "de")}
                {e.mitarbeiter_name && <> · {e.mitarbeiter_name}</>}{e.version > 1 && <> · Version {e.version}</>}
              </div>
            </div>
            <div className="aus-item-side">
              {e.offeneMaengel > 0 && <span className="abn-chip is-bad">{e.offeneMaengel} offene Mängel</span>}
              <span className={e.status === "abgeschlossen" ? "abn-chip is-ok" : "abn-chip"}>{e.status === "abgeschlossen" ? "abgeschlossen" : e.status === "in_arbeit" ? "in Arbeit" : e.status === "entwurf" ? "Entwurf" : "bereit"}</span>
              {e.pdf_path && (
                <a className="aus-btn aus-btn-quiet aus-btn-sm" href={`/api/abnahme/pdf?typ=${e.typ}&id=${e.id}`}>PDF</a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
