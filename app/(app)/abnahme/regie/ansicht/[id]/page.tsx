import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createClient } from "@/lib/supabase/server";
import { listStaende, listVersand } from "@/lib/data/abnahme";
import { formatDatum, formatDatumZeit } from "@/lib/abnahme/i18n";
import { rowsToRegie, summen } from "@/lib/abnahme/regie-logic";
import { DetailAktionen } from "@/components/abnahme/DetailAktionen";

export const metadata = { title: "Regiebericht" };

export default async function RegieAnsicht({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAppAccess("abnahme");
  const { id } = await params;
  const supabase = await createClient();
  const r = await supabase.from("abnahme_regieberichte").select("*").eq("id", id).maybeSingle();
  if (!r.data) notFound();
  const z = await supabase.from("abnahme_regie_zeilen").select("*").eq("regiebericht_id", id).order("pos");
  const doc = rowsToRegie(r.data, z.data ?? []);
  const sum = summen(doc.zeilen);
  const [versand, staende] = await Promise.all([listVersand("regie", id), listStaende(id, "regie")]);

  return (
    <>
      <header className="aus-head">
        <Link className="aus-back" href="/abnahme">← Ablage</Link>
        <span className="aus-eyebrow">Regiebericht</span>
        <h1 className="aus-h1">{doc.kommissionNr} · {doc.kunde}</h1>
      </header>
      <div className="aus-card">
        <dl className="aus-kv">
          <dt>Status</dt><dd>{doc.status === "abgeschlossen" ? "abgeschlossen" : "Entwurf"}</dd>
          <dt>Datum</dt><dd>{formatDatum(doc.datum, "de")}</dd>
          {doc.name && (<><dt>Name</dt><dd>{doc.name}</dd></>)}
          {(doc.strasse || doc.ort) && (<><dt>Adresse</dt><dd>{[doc.strasse, doc.ort].filter(Boolean).join(", ")}</dd></>)}
          {doc.telefon && (<><dt>Telefon</dt><dd>{doc.telefon}</dd></>)}
          <dt>Mitarbeiter</dt><dd>{doc.mitarbeiterName || "—"}</dd>
          <dt>Arbeitszeit</dt><dd>Meister {sum.Meister} · Monteur {sum.Monteur} · Lehrling {sum.Lehrling} · Helfer {sum.Helfer} · gesamt {sum.gesamt} h</dd>
          {doc.beschreibung && (<><dt>Auftrag</dt><dd>{doc.beschreibung}</dd></>)}
        </dl>
        {doc.pdfPath && (
          <div className="aus-actions">
            <a className="aus-btn aus-btn-primary" href={`/api/abnahme/pdf?typ=regie&id=${id}`}>PDF herunterladen</a>
            <a className="aus-btn aus-btn-secondary" href={`/api/abnahme/pdf?typ=regie&id=${id}&inline=1`} target="_blank" rel="noreferrer">PDF ansehen</a>
          </div>
        )}
        {doc.status !== "abgeschlossen" && <Link className="aus-btn aus-btn-secondary" href={`/abnahme/begehung?id=${id}`}>Auf dem Tablet bearbeiten</Link>}
      </div>
      {staende.length > 0 && (
        <section className="aus-card">
          <h2 className="aus-h2">Frühere Stände (Abgleich)</h2>
          <p className="aus-muted">Vor jedem Abgleich zweier Stände werden beide archiviert. Zum Nachsehen als JSON herunterladbar.</p>
          <ul className="aus-list">
            {staende.map((s) => (
              <li key={s.id} className="aus-item">
                <div className="aus-item-main">
                  <strong>{s.art === "tablet" ? "Stand des Tablets" : "Stand des Servers"}</strong> · Version {s.rev}
                  <div className="aus-item-meta">{formatDatumZeit(s.created_at, "de")}{s.von ? ` · ${s.von}` : ""}</div>
                </div>
                <div className="aus-item-side"><a href={`/api/abnahme/stand?typ=regie&id=${s.id}`}>JSON</a></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <DetailAktionen typ="regie" id={id} abgeschlossen={doc.status === "abgeschlossen"} hatPdf={Boolean(doc.pdfPath)} kundeEmail={doc.kundeEmail} kopieEmail={doc.kopieEmail} istAdmin={ctx.isFinance} offeneMaengel={[]} />
      <div className="aus-card">
        <h2 className="aus-h2">Versandprotokoll</h2>
        {versand.length === 0 ? <p className="aus-muted">Noch nicht versendet.</p> : (
          <ul className="aus-list">
            {versand.map((v) => (
              <li key={v.id} className="aus-item">
                <div className="aus-item-main"><strong>{v.an}</strong><div className="aus-item-meta">{formatDatumZeit(v.ausgeloest_at, "de")}{v.ausgeloest_von_name && <> · {v.ausgeloest_von_name}</>}</div></div>
                <div className="aus-item-side"><span className={v.status === "gesendet" ? "abn-chip is-ok" : v.status === "fehler" ? "abn-chip is-bad" : "abn-chip"}>{v.status}</span>{v.fehler && <span className="aus-field-error">{v.fehler}</span>}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
