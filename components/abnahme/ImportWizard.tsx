"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildDocFromParsed } from "@/lib/abnahme/build";
import { parseProfactoPdf } from "@/lib/abnahme/parser/pdf-text";
import { ladeFuerBaustelle } from "@/lib/abnahme/offline/sync";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import type { ParsedList } from "@/lib/abnahme/parser/types";
import type { ProtokollDoc, Vorlage } from "@/lib/abnahme/types";
import { StrukturEditor } from "@/components/abnahme/StrukturEditor";
import { findeKommissionAction, legeProtokollAn } from "@/app/(app)/abnahme/actions";
import { KundeKommissionAuswahl } from "@/components/abnahme/KundeKommissionAuswahl";
import { LEERE_AUSWAHL, wendeAuswahlAn, type KundeKommission } from "@/lib/abnahme/kommission";
import { validiereNeuesProtokoll } from "@/lib/abnahme/validate";

export function ImportWizard({
  vorlagen,
  mitarbeiter,
}: {
  vorlagen: Vorlage[];
  mitarbeiter: { id: string | null; name: string };
}) {
  const [doc, setDoc] = useState<ProtokollDoc | null>(null);
  const [parsed, setParsed] = useState<ParsedList | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kk, setKk] = useState<KundeKommission>(LEERE_AUSWAHL);
  const [busy, setBusy] = useState<"" | "lesen" | "speichern">("");
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState<string | null>(null);
  const [offlineSpeichern, setOfflineSpeichern] = useState(true);
  const [offline, setOffline] = useState<"" | "laeuft" | "ok" | string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  /** Sucht die Kommissionsnummer aus der PDF: gefunden → bestehend, sonst „neu anlegen“ mit den PDF-Daten vorbelegt. */
  async function kommissionAusPdf(nr: string, kunde: string, projekt: string): Promise<KundeKommission> {
    const clean = nr.trim();
    if (!clean) return { ...LEERE_AUSWAHL, kunde, projekt };
    const t = await findeKommissionAction(clean);
    if (t) return { modus: "bestehend", commissionId: t.id, nr: t.nr, kunde: t.kunde || kunde, projekt: projekt || t.projekt };
    return { modus: /^\d{6}$/.test(clean) ? "neu" : "bestehend", commissionId: null, nr: /^\d{6}$/.test(clean) ? clean : "", kunde, projekt };
  }

  async function dateiGewaehlt(f: File | null) {
    if (!f) return;
    setFehler("");
    setFertig(null);
    setBusy("lesen");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const data = new Uint8Array(await f.arrayBuffer());
      const result = await parseProfactoPdf(data, pdfjs as never);
      const neu = buildDocFromParsed(result, vorlagen, {
        id: crypto.randomUUID(),
        mitarbeiterId: mitarbeiter.id,
        mitarbeiterName: mitarbeiter.name,
      });
      setParsed(result);
      setDoc(neu);
      setFile(f);
      setKk(await kommissionAusPdf(neu.kommissionNr, neu.kunde, neu.projekt));
    } catch (e) {
      console.error(e);
      setFehler("Die PDF konnte nicht gelesen werden. Ist es die Profacto-Liste „Einfache Positionsliste“?");
    } finally {
      setBusy("");
    }
  }

  function update(patch: Partial<ProtokollDoc>) {
    setDoc((d) => (d ? { ...d, ...patch } : d));
  }
  const probleme = doc ? validiereNeuesProtokoll(doc, kk) : [];

  async function speichern() {
    if (!doc || !file || probleme.length) return;
    setBusy("speichern");
    setFehler("");
    const supabase = createClient();
    const pfad = `protokoll/${doc.id}/original.pdf`;
    try {
      const up = await supabase.storage.from("abnahme").upload(pfad, file, { contentType: "application/pdf", upsert: true });
      if (up.error) throw new Error(`Original-PDF konnte nicht abgelegt werden: ${up.error.message}`);
      const res = await legeProtokollAn({ ...wendeAuswahlAn(doc, kk), originalPath: pfad }, { kommission: kk.modus, quelle: "profacto" });
      if (!res.ok) {
        await supabase.storage.from("abnahme").remove([pfad]);
        throw new Error(res.error);
      }
      setFertig(res.data.id);
      // Sofort auf diesem Gerät offline ablegen (auschecken, Daten und App-Shell lokal speichern).
      if (offlineSpeichern) {
        setOffline("laeuft");
        await registriereAbnahmeSw();
        const l = await ladeFuerBaustelle("abnahme", res.data.id);
        setOffline(l.ok ? "ok" : l.error);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy("");
    }
  }

  if (fertig) {
    return (
      <div className="aus-card abn-done">
        <h2 className="aus-h2">Protokoll angelegt</h2>
        <p>{kk.modus === "ohne" ? "Ohne Kommission" : `Kommission ${kk.nr}`} · {kk.kunde}.</p>
        {offline === "laeuft" && <p className="aus-muted">Wird für die Baustelle auf diesem Gerät gespeichert …</p>}
        {offline === "ok" && <p className="aus-field-ok" role="status">Auf diesem Gerät offline gespeichert. Die Begehung funktioniert jetzt auch ohne Internet.</p>}
        {offline !== "" && offline !== "laeuft" && offline !== "ok" && (
          <p className="aus-field-error" role="alert">Nicht offline gespeichert: {offline} Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>
        )}
        {offline === "" && <p className="aus-muted">Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>}
        <div className="aus-actions">
          <Link className="aus-btn aus-btn-primary" href={`/abnahme/begehung?id=${fertig}`}>Zur Begehung</Link>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme">Zur Ablage</Link>
          <button type="button" className="aus-btn aus-btn-quiet" onClick={() => { setDoc(null); setParsed(null); setFile(null); setFertig(null); }}>
            Weitere PDF importieren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="abn-import">
      <section className="aus-card abn-drop">
        <h2 className="aus-h2">1 · PDF wählen</h2>
        {doc && (
          <div className="aus-actions">
            <button
              type="button"
              className="aus-btn aus-btn-quiet"
              onClick={() => {
                if (!window.confirm("Import verwerfen? Es wurde noch nichts angelegt.")) return;
                setDoc(null); setParsed(null); setFile(null); setKk(LEERE_AUSWAHL); setFehler("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Import verwerfen
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="aus-input"
          onChange={(e) => dateiGewaehlt(e.target.files?.[0] ?? null)}
        />
        {busy === "lesen" && <p className="aus-muted">PDF wird gelesen …</p>}
        {fehler && !doc && <p className="aus-field-error" role="alert">{fehler}</p>}
      </section>

      {doc && parsed && (
        <>
          {parsed.warnings.length > 0 && (
            <div className="aus-note" role="status">
              <div className="aus-note-body">
                <p className="aus-note-title">Hinweise zum Lesen der Liste</p>
                <ul>{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
          )}

          <section className="aus-card">
            <h2 className="aus-h2">2 · Kunde, Kommission und Kopf</h2>
            <KundeKommissionAuswahl
              value={kk}
              onChange={setKk}
              hinweisKunde="Profacto schneidet den Namen ab – bitte vollständig eintragen."
            />
            <div className="aus-grid abn-kopf">
              <label className="aus-field">
                <span className="aus-label">Baustellenadresse / Ort</span>
                <input className="aus-input" value={doc.ort} onChange={(e) => update({ ort: e.target.value })} />
              </label>
              <label className="aus-field">
                <span className="aus-label">Bezeichnung (z. B. Teilabnahme EG)</span>
                <input className="aus-input" value={doc.titel} onChange={(e) => update({ titel: e.target.value })} />
              </label>
              <label className="aus-field">
                <span className="aus-label">Sprache des Protokolls</span>
                <select className="aus-select" value={doc.sprache} onChange={(e) => update({ sprache: e.target.value === "en" ? "en" : "de" })}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="aus-field">
                <span className="aus-label">Kunden-E-Mail (optional, für automatischen Versand)</span>
                <input className="aus-input" type="email" inputMode="email" value={doc.kundeEmail} onChange={(e) => update({ kundeEmail: e.target.value })} />
              </label>
            </div>
          </section>

          <StrukturEditor doc={doc} setDoc={(f) => setDoc((d) => (d ? f(d) : d))} vorlagen={vorlagen} modus="import" />

          <section className="aus-card">
            <h2 className="aus-h2">3 · Anlegen</h2>
            {probleme.length > 0 && <ul className="aus-field-error">{probleme.map((p) => <li key={p}>{p}</li>)}</ul>}
            {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
            <p className="aus-muted">Das Original-PDF wird zusätzlich im Protokoll abgelegt.</p>
            <label className="abn-inline">
              <input type="checkbox" checked={offlineSpeichern} onChange={(e) => setOfflineSpeichern(e.target.checked)} />
              Gleich auf diesem Gerät offline speichern (für die Baustelle)
            </label>
            <p className="aus-help">Das Protokoll ist dann auf diesem Gerät ausgecheckt. Für ein anderes Tablet bitte abwählen und dort „Für Baustelle laden“ nutzen.</p>
            <div className="aus-actions">
              <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={busy === "speichern" || probleme.length > 0} onClick={speichern}>
                {busy === "speichern" ? "Wird angelegt …" : "Abnahmeprotokoll anlegen"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
