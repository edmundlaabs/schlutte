"use client";

import { useEffect, useState } from "react";
import { findeUnterschrift, kannAbschliessen, offeneUnterschriften } from "@/lib/abnahme/logic";
import { ladeMitarbeiterLokal } from "@/lib/abnahme/offline/store";
import type { LokalesDokument } from "@/lib/abnahme/offline/db";
import type { ProtokollDoc } from "@/lib/abnahme/types";
import { BlobImg } from "./BlobImg";
import { schliesseProtokollAb } from "@/lib/abnahme/abschluss";
import { AblageAktionen } from "./AblageAktionen";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

export function AbschlussView({
  eintrag, online, onAendere, onAendereEintrag, onSign,
}: {
  eintrag: Abnahme;
  online: boolean;
  onAendere: (fn: (d: ProtokollDoc) => ProtokollDoc) => void;
  onAendereEintrag: (fn: (e: Abnahme) => Abnahme) => void;
  onSign: (bezug: "schluss_kunde" | "schluss_mitarbeiter", titel: string, rolle: string, name: string) => void;
}) {
  const doc = eintrag.doc;
  const gesperrt = doc.status === "abgeschlossen";
  const [mitarbeiter, setMitarbeiter] = useState<{ id: string; name: string }[]>([]);
  const [neuerName, setNeuerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  useEffect(() => {
    void ladeMitarbeiterLokal().then(setMitarbeiter);
  }, []);

  const pruefung = kannAbschliessen(doc);
  const offeneU = offeneUnterschriften(doc);
  const kunde = findeUnterschrift(doc, "schluss_kunde", null);
  const ma = findeUnterschrift(doc, "schluss_mitarbeiter", null);
  const [geoeffnetAm] = useState(() => Date.now());
  const jetzt = new Date(doc.abgeschlossenAt ?? geoeffnetAm);
  const letzterKunde = [...doc.unterschriften].reverse().find((u) => u.rolle === "Kunde")?.name ?? "";

  function teilnehmerHinzu(name: string, rolle: string, employeeId?: string) {
    const n = name.trim();
    if (!n) return;
    onAendere((d) => (d.teilnehmer.some((t) => t.name === n) ? d : { ...d, teilnehmer: [...d.teilnehmer, { name: n, rolle, employeeId }] }));
  }

  async function vorschau() {
    setBusy(true);
    setFehler("");
    try {
      const { erzeugeProtokollPdfLokal } = await import("@/lib/abnahme/pdf/lokal");
      const bytes = await erzeugeProtokollPdfLokal(doc);
      window.open(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })), "_blank");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Vorschau fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function abschliessen() {
    if (!pruefung.ok) return;
    if (!window.confirm("Protokoll jetzt abschließen? Danach ist es gesperrt (nur noch Nachtrag).")) return;
    setBusy(true);
    setFehler("");
    try {
      await schliesseProtokollAb(doc, onAendere, onAendereEintrag);
    } catch (e) {
      console.error(e);
      setFehler(e instanceof Error ? e.message : "Abschluss fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="abn-abschluss">
      <h2 className="aus-h2">{gesperrt ? "Abgeschlossenes Protokoll" : "Abschluss"}</h2>

      <div className="aus-card">
        <div className="aus-grid abn-kopf">
          <label className="aus-field">
            <span className="aus-label">Ort <span className="aus-req">*</span></span>
            <input className="aus-input" disabled={gesperrt} value={doc.ort} onChange={(e) => onAendere((d) => ({ ...d, ort: e.target.value }))} />
          </label>
          <div className="aus-field">
            <span className="aus-label">Datum / Uhrzeit</span>
            <div className="abn-readonly">{jetzt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          <div className="aus-field">
            <span className="aus-label">Durchführender Mitarbeiter</span>
            <div className="abn-readonly">{doc.mitarbeiterName || "—"}</div>
          </div>
          <label className="aus-field">
            <span className="aus-label">Kunden-E-Mail (für Versand)</span>
            <input className="aus-input" type="email" inputMode="email" disabled={gesperrt} value={doc.kundeEmail} onChange={(e) => onAendere((d) => ({ ...d, kundeEmail: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="aus-card">
        <h3 className="aus-card-title">Teilnehmer</h3>
        <ul className="abn-teilnehmer">
          {doc.teilnehmer.map((t) => (
            <li key={t.name}>
              {t.name}{t.rolle && <span className="aus-muted"> · {t.rolle}</span>}
              {!gesperrt && (
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => onAendere((d) => ({ ...d, teilnehmer: d.teilnehmer.filter((x) => x.name !== t.name) }))}>Entfernen</button>
              )}
            </li>
          ))}
          {doc.teilnehmer.length === 0 && <li className="aus-muted">Noch keine Teilnehmer.</li>}
        </ul>
        {!gesperrt && (
          <div className="abn-teilnehmer-add">
            <select
              className="aus-select"
              aria-label="Monteur hinzufügen"
              value=""
              onChange={(e) => {
                const m = mitarbeiter.find((x) => x.id === e.target.value);
                if (m) teilnehmerHinzu(m.name, "Monteur", m.id);
              }}
            >
              <option value="">Mitarbeiter hinzufügen …</option>
              {mitarbeiter.filter((m) => m.id !== doc.mitarbeiterId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input className="aus-input" placeholder="Name (Kunde, weitere Person)" value={neuerName} onChange={(e) => setNeuerName(e.target.value)} />
            <button type="button" className="aus-btn aus-btn-secondary" disabled={!neuerName.trim()} onClick={() => { teilnehmerHinzu(neuerName, "Kunde / Gast"); setNeuerName(""); }}>Hinzufügen</button>
          </div>
        )}
      </div>

      <div className="aus-card">
        <label className="aus-field">
          <span className="aus-label">Bemerkung zum Gesamtprotokoll</span>
          <textarea className="aus-textarea" rows={4} disabled={gesperrt} value={doc.bemerkung} onChange={(e) => onAendere((d) => ({ ...d, bemerkung: e.target.value }))} />
        </label>
      </div>

      <div className="aus-card">
        <h3 className="aus-card-title">Schlussunterschriften</h3>
        <div className="abn-sig-zeile">
          <strong>Kunde</strong>
          {kunde ? <span className="abn-sig-ok"><BlobImg id={kunde.id} alt="Unterschrift Kunde" className="abn-sig-img" /> {kunde.name}</span> : <span className="aus-muted">fehlt</span>}
          {!gesperrt && <button type="button" className="aus-btn aus-btn-secondary" onClick={() => onSign("schluss_kunde", "Schlussunterschrift Kunde", "Kunde", letzterKunde)}>{kunde ? "Neu" : "Unterschreiben"}</button>}
        </div>
        <div className="abn-sig-zeile">
          <strong>Mitarbeiter</strong>
          {ma ? <span className="abn-sig-ok"><BlobImg id={ma.id} alt="Unterschrift Mitarbeiter" className="abn-sig-img" /> {ma.name}</span> : <span className="aus-muted">fehlt</span>}
          {!gesperrt && <button type="button" className="aus-btn aus-btn-secondary" onClick={() => onSign("schluss_mitarbeiter", "Schlussunterschrift Mitarbeiter", "Mitarbeiter", doc.mitarbeiterName)}>{ma ? "Neu" : "Unterschreiben"}</button>}
        </div>
      </div>

      {!gesperrt && (
        <div className="aus-card">
          {!pruefung.ok && (
            <ul className="aus-field-error">{pruefung.gruende.map((g) => <li key={g}>{g}</li>)}</ul>
          )}
          {(offeneU.raeume.length > 0 || offeneU.positionen.length > 0) && (
            <p className="aus-muted">Hinweis: {offeneU.raeume.length} Raum- und {offeneU.positionen.length} Mangel-Unterschrift(en) fehlen noch (kein Muss).</p>
          )}
          {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-secondary" disabled={busy} onClick={vorschau}>PDF-Vorschau</button>
            <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={!pruefung.ok || busy} onClick={abschliessen}>
              {busy ? "Wird abgeschlossen …" : "Protokoll abschließen"}
            </button>
          </div>
        </div>
      )}

      {gesperrt && <AblageAktionen eintrag={eintrag} online={online} onAendereEintrag={onAendereEintrag} />}
    </section>
  );
}
