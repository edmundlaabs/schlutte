import Link from "next/link";
import { listAblage } from "@/lib/data/abnahme";
import { formatDatum } from "@/lib/abnahme/i18n";
import { kommissionAnzeige } from "@/lib/abnahme/kommission";
import { requireAppAccess } from "@/lib/auth/app-access";
import { AblageLoeschen } from "@/components/abnahme/AblageLoeschen";

export const metadata = { title: "Ablage" };

type SP = { q?: string; typ?: string; status?: string; mitarbeiter?: string; von?: string; bis?: string; kommission?: string };

const statusText = (s: string) =>
  s === "abgeschlossen" ? "abgeschlossen" : s === "in_arbeit" ? "in Arbeit" : s === "entwurf" ? "Entwurf" : "bereit";

export default async function AblagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireAppAccess("abnahme");
  let eintraege: Awaited<ReturnType<typeof listAblage>> = [];
  let fehler = "";
  try {
    eintraege = await listAblage(sp);
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Ablage nicht verfügbar.";
  }
  const hatFilter = Object.values(sp).some(Boolean);
  const heute = new Date();
  const inArbeit = eintraege.filter((e) => e.status !== "abgeschlossen").length;
  const offenGesamt = eintraege.reduce((n, e) => n + e.offeneMaengel, 0);

  return (
    <>
      <header className="abn-doc-head">
        <div>
          <h1 className="abn-doc-h1">Ablage</h1>
          <p className="abn-doc-lede">Abnahmeprotokolle und Regieberichte. Mit offenen Mängeln markierte Protokolle brauchen einen Nachtrag.</p>
        </div>
        <dl className="abn-meta">
          <div>
            <dt>{heute.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}</dt>
            <dd>{heute.getFullYear()}</dd>
          </div>
          <div>
            <dt>Dokumente</dt>
            <dd>{inArbeit} in Arbeit{offenGesamt > 0 && <> · <span className="abn-rot">{offenGesamt} offen</span></>}</dd>
          </div>
        </dl>
      </header>

      <div className="abn-aktionen">
        <Link className="aus-btn aus-btn-primary" href="/abnahme/neu/manuell">Abnahme manuell anlegen</Link>
        <Link className="aus-btn aus-btn-secondary" href="/abnahme/neu">Aus Profacto-PDF</Link>
        <Link className="aus-btn aus-btn-secondary" href="/abnahme/begehung">Begehung</Link>
        <Link className="aus-btn aus-btn-secondary" href="/abnahme/regie">Regiebericht</Link>
      </div>

      <form className="abn-filter" method="get">
        <input className="aus-input abn-filter-q" name="q" placeholder="Kommission oder Kunde" defaultValue={sp.q ?? ""} aria-label="Kommission oder Kunde" />
        <select className="aus-select" name="typ" defaultValue={sp.typ ?? ""} aria-label="Typ">
          <option value="">Alle Typen</option>
          <option value="abnahme">Abnahmeprotokoll</option>
          <option value="regie">Regiebericht</option>
        </select>
        <select className="aus-select" name="kommission" defaultValue={sp.kommission ?? ""} aria-label="Kommission">
          <option value="">Mit und ohne Kommission</option>
          <option value="ohne">Nur ohne Kommission</option>
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
        <div className="abn-filter-btns">
          <button className="aus-btn aus-btn-secondary" type="submit">Filtern</button>
          {hatFilter && <Link className="aus-btn aus-btn-quiet" href="/abnahme">Zurücksetzen</Link>}
        </div>
      </form>

      {fehler && (
        <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehler} Wurde die Migration <code>20261120_abnahme.sql</code> ausgeführt?</p></div></div>
      )}
      {!fehler && eintraege.length === 0 && <p className="aus-muted">Keine Dokumente gefunden.</p>}

      <ol className="abn-eintraege">
        {eintraege.map((e, i) => {
          const href = e.typ === "abnahme" ? `/abnahme/protokoll/${e.id}` : `/abnahme/regie/ansicht/${e.id}`;
          return (
            <li key={`${e.typ}-${e.id}`} className="abn-eintrag">
              <div className="abn-eintrag-kopf">
                <Link className="abn-eintrag-titel" href={href}>
                  <span className="abn-nr">{i + 1}.</span> {e.typ === "abnahme" ? "Abnahmeprotokoll" : "Regiebericht"} {kommissionAnzeige(e.kommission_nr, "de")}
                </Link>
                <div className="abn-eintrag-chips">
                  <span className={e.status === "abgeschlossen" ? "abn-chip is-ok" : "abn-chip"}>{statusText(e.status)}</span>
                  {e.offeneMaengel > 0 && <span className="abn-chip is-bad">{e.offeneMaengel} offene{e.offeneMaengel === 1 ? "r Mangel" : " Mängel"}</span>}
                </div>
              </div>
              <div className="abn-eintrag-body">
                <div>
                  <div className="abn-caps">Kunde</div>
                  <div className="abn-eintrag-kunde">{e.kunde}</div>
                  {(e.projekt || e.titel) && <div>{[e.titel, e.projekt].filter(Boolean).join(" · ")}</div>}
                  <div className="abn-muted">
                    {formatDatum(e.datum, "de")}
                    {e.mitarbeiter_name && <> · {e.mitarbeiter_name}</>}
                    {e.version > 1 && <> · Version {e.version}</>}
                  </div>
                </div>
                <div className="abn-eintrag-links">
                  <Link href={href}>Öffnen</Link>
                  {e.pdf_path && <a href={`/api/abnahme/pdf?typ=${e.typ}&id=${e.id}`}>PDF</a>}
                  {(e.status !== "abgeschlossen" || ctx.isFinance) && (
                    <AblageLoeschen
                      typ={e.typ}
                      id={e.id}
                      abgeschlossen={e.status === "abgeschlossen"}
                      bezeichnung={`${e.typ === "regie" ? "Regiebericht" : "Abnahmeprotokoll"} ${kommissionAnzeige(e.kommission_nr, "de")} · ${e.kunde}`}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {eintraege.length > 0 && (
        <div className="abn-summe">
          <span>Gesamt {eintraege.length} {eintraege.length === 1 ? "Dokument" : "Dokumente"}</span>
          <span>{offenGesamt > 0 ? <span className="abn-rot">{offenGesamt} offene Mängel</span> : "keine offenen Mängel"}</span>
        </div>
      )}
    </>
  );
}
