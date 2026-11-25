import Link from "next/link";
import { notFound } from "next/navigation";
import { ladeProtokollDoc, listStaende, listVersand, listVersionen } from "@/lib/data/abnahme";
import { requireAppAccess } from "@/lib/auth/app-access";
import { formatDatum, formatDatumZeit } from "@/lib/abnahme/i18n";
import { fortschritt, relevantePositionen } from "@/lib/abnahme/logic";
import { DetailAktionen } from "@/components/abnahme/DetailAktionen";
import { KommissionZuordnen } from "@/components/abnahme/KommissionZuordnen";
import { MitarbeiterAendern } from "@/components/abnahme/MitarbeiterAendern";
import { getActiveEmployees } from "@/lib/data/employees";
import { hatKommission, kommissionAnzeige } from "@/lib/abnahme/kommission";

export const metadata = { title: "Protokoll" };

export default async function ProtokollDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAppAccess("abnahme");
  const { id } = await params;
  const doc = await ladeProtokollDoc(id);
  if (!doc) notFound();
  const [versand, versionen, staende] = await Promise.all([listVersand("abnahme", id), listVersionen(id), listStaende(id)]);
  const f = fortschritt(relevantePositionen(doc));
  const offene = doc.maengel.filter((m) => !m.erledigtAt);
  const istAdmin = ctx.isFinance;
  const mitarbeiterListe = (await getActiveEmployees().catch(() => [])).filter((e) => e.id && e.is_active !== false).map((e) => ({ id: e.id as string, name: e.name }));

  return (
    <>
      <header className="aus-head">
        <Link className="aus-back" href="/abnahme">← Ablage</Link>
        <span className="aus-eyebrow">Abnahmeprotokoll{doc.version > 1 ? ` · Version ${doc.version}` : ""}</span>
        <h1 className="aus-h1">{kommissionAnzeige(doc.kommissionNr, "de")} · {doc.kunde}</h1>
        {doc.titel && <p className="aus-lede">{doc.titel}</p>}
      </header>

      <div className="aus-card">
        <dl className="aus-kv">
          <dt>Status</dt><dd>{doc.status === "abgeschlossen" ? "abgeschlossen" : doc.status === "in_arbeit" ? "in Arbeit" : "bereit"}</dd>
          {doc.projekt && (<><dt>Projekt</dt><dd>{doc.projekt}</dd></>)}
          {doc.ort && (<><dt>Ort</dt><dd>{doc.ort}</dd></>)}
          <dt>Herkunft</dt><dd>{doc.quelle === "manuell" ? "manuell angelegt" : doc.quelle === "vorlage" ? "aus Protokoll-Vorlage" : "Profacto-Import"}</dd>
          <dt>Mitarbeiter</dt><dd>{doc.mitarbeiterName || "—"} {doc.status !== "abgeschlossen" && <MitarbeiterAendern id={id} aktuell={doc.mitarbeiterName} mitarbeiter={mitarbeiterListe} />}</dd>
          {doc.teilnehmer.length > 0 && (<><dt>Teilnehmer</dt><dd>{doc.teilnehmer.map((t) => t.name).join(", ")}</dd></>)}
          <dt>Datum</dt><dd>{formatDatumZeit(doc.abgeschlossenAt ?? doc.beginnAt, "de") || "—"}</dd>
          <dt>Sprache</dt><dd>{doc.sprache === "en" ? "English" : "Deutsch"}</dd>
          <dt>Positionen</dt><dd>{f.gesamt} · i. O. {f.io} · Mangel {f.mangel} · nicht prüfbar {f.nichtPruefbar} · offen {f.offen}</dd>
        </dl>
        <div className="aus-actions">
          {doc.pdfPath && (
            <>
              <a className="aus-btn aus-btn-primary" href={`/api/abnahme/pdf?typ=abnahme&id=${id}`}>PDF herunterladen</a>
              <a className="aus-btn aus-btn-secondary" href={`/api/abnahme/pdf?typ=abnahme&id=${id}&inline=1`} target="_blank" rel="noreferrer">PDF ansehen</a>
            </>
          )}
          {doc.originalPath && <a className="aus-btn aus-btn-quiet" href={`/api/abnahme/pdf?typ=abnahme&id=${id}&art=original`}>Original-Positionsliste</a>}
          {doc.status !== "abgeschlossen" && <Link className="aus-btn aus-btn-secondary" href={`/abnahme/begehung?id=${id}`}>Zur Begehung (Tablet)</Link>}
        </div>
      </div>

      {!hatKommission(doc) && doc.status !== "abgeschlossen" && (
        <KommissionZuordnen id={id} />
      )}

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
                <div className="aus-item-side"><a href={`/api/abnahme/stand?id=${s.id}`}>JSON</a></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DetailAktionen
        id={id}
        abgeschlossen={doc.status === "abgeschlossen"}
        hatPdf={Boolean(doc.pdfPath)}
        kundeEmail={doc.kundeEmail}
        kopieEmail={doc.kopieEmail}
        istAdmin={istAdmin}
        nachtraege={versionen.filter((v) => v.version > doc.version).length}
        offeneMaengel={offene.map((m) => {
          const pos = doc.positionen.find((p) => p.id === m.positionId);
          const raum = doc.raeume.find((r) => r.id === m.raumId);
          return { id: m.id, text: m.text, frist: m.frist ? formatDatum(m.frist, "de") : "", wo: `${raum?.name ?? ""}${pos ? ` · ${pos.nr} ${pos.titel}` : ""}` };
        })}
      />

      {versionen.length > 1 && (
        <div className="aus-card">
          <h2 className="aus-h2">Versionen</h2>
          <ul className="aus-list">
            {versionen.map((v) => (
              <li key={v.id} className="aus-item">
                <Link href={`/abnahme/protokoll/${v.id}`}>Version {v.version}{v.id === id ? " (diese)" : ""}</Link>
                <span className="aus-muted"> · {v.status === "abgeschlossen" ? `abgeschlossen ${formatDatum(v.abgeschlossen_at, "de")}` : v.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="aus-card">
        <h2 className="aus-h2">Versandprotokoll</h2>
        {versand.length === 0 ? <p className="aus-muted">Noch nicht versendet.</p> : (
          <ul className="aus-list">
            {versand.map((v) => (
              <li key={v.id} className="aus-item">
                <div className="aus-item-main">
                  <strong>{v.an}</strong>{v.kopie && <span className="aus-muted"> (Kopie: {v.kopie})</span>}
                  <div className="aus-item-meta">{formatDatumZeit(v.ausgeloest_at, "de")}{v.ausgeloest_von_name && <> · {v.ausgeloest_von_name}</>}</div>
                </div>
                <div className="aus-item-side">
                  <span className={v.status === "gesendet" ? "abn-chip is-ok" : v.status === "fehler" ? "abn-chip is-bad" : "abn-chip"}>{v.status}</span>
                  {v.fehler && <span className="aus-field-error">{v.fehler}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
