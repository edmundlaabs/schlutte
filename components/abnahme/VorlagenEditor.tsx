"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loescheVorlage, speichereVorlage } from "@/app/(app)/abnahme/vorlagen/actions";
import type { Vorlage } from "@/lib/abnahme/types";

type Form = { id?: string; moebeltyp: string; titelDe: string; titelEn: string; punkteText: string; aktiv: boolean; sort: number };

const aus = (v: Vorlage): Form => ({
  id: v.id, moebeltyp: v.moebeltyp, titelDe: v.titelDe, titelEn: v.titelEn, aktiv: v.aktiv, sort: v.sort,
  punkteText: v.punkte.map((p) => (p.en && p.en !== p.de ? `${p.de} | ${p.en}` : p.de)).join("\n"),
});

export function VorlagenEditor({ vorlagen }: { vorlagen: Vorlage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const [fehler, setFehler] = useState("");

  function speichern() {
    if (!form) return;
    setFehler("");
    start(async () => {
      const r = await speichereVorlage(form);
      if (r.ok) {
        setForm(null);
        router.refresh();
      } else setFehler(r.error);
    });
  }
  function loeschen(v: Vorlage) {
    if (!window.confirm(`Vorlage „${v.moebeltyp}“ löschen? Bereits angelegte Protokolle behalten ihre Prüfpunkte.`)) return;
    start(async () => {
      const r = await loescheVorlage(v.id);
      if (!r.ok) setFehler(r.error);
      router.refresh();
    });
  }

  return (
    <div className="abn-import">
      <ul className="aus-list">
        {vorlagen.map((v) => (
          <li key={v.id} className="aus-item">
            <div className="aus-item-main">
              <strong>{v.moebeltyp}</strong>{!v.aktiv && <span className="aus-muted"> · inaktiv</span>}
              <div className="aus-item-meta">{v.punkte.length} Prüfpunkte: {v.punkte.map((p) => p.de).join(" · ")}</div>
            </div>
            <div className="aus-item-side">
              <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => setForm(aus(v))}>Bearbeiten</button>
              <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending} onClick={() => loeschen(v)}>Löschen</button>
            </div>
          </li>
        ))}
        {vorlagen.length === 0 && <li className="aus-muted">Noch keine Vorlagen.</li>}
      </ul>
      {!form && <div className="aus-actions"><button type="button" className="aus-btn aus-btn-primary" onClick={() => setForm({ moebeltyp: "", titelDe: "", titelEn: "", punkteText: "", aktiv: true, sort: (vorlagen.at(-1)?.sort ?? 0) + 10 })}>Neue Vorlage</button></div>}
      {form && (
        <section className="aus-card">
          <h2 className="aus-h2">{form.id ? "Vorlage bearbeiten" : "Neue Vorlage"}</h2>
          <div className="aus-grid abn-kopf">
            <label className="aus-field"><span className="aus-label">Möbeltyp *</span>
              <input className="aus-input" value={form.moebeltyp} onChange={(e) => setForm({ ...form, moebeltyp: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Titel (Deutsch)</span>
              <input className="aus-input" value={form.titelDe} onChange={(e) => setForm({ ...form, titelDe: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Titel (English)</span>
              <input className="aus-input" value={form.titelEn} onChange={(e) => setForm({ ...form, titelEn: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Reihenfolge</span>
              <input className="aus-input" inputMode="numeric" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })} /></label>
          </div>
          <label className="aus-field"><span className="aus-label">Prüfpunkte (eine Zeile je Punkt, optional „Deutsch | English“)</span>
            <textarea className="aus-textarea" rows={8} value={form.punkteText} onChange={(e) => setForm({ ...form, punkteText: e.target.value })} /></label>
          <label className="abn-inline"><input type="checkbox" checked={form.aktiv} onChange={(e) => setForm({ ...form, aktiv: e.target.checked })} /> aktiv</label>
          {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-primary" disabled={pending || !form.moebeltyp.trim()} onClick={speichern}>Speichern</button>
            <button type="button" className="aus-btn aus-btn-quiet" onClick={() => { setForm(null); setFehler(""); }}>Abbrechen</button>
          </div>
        </section>
      )}
      {!form && fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
    </div>
  );
}
