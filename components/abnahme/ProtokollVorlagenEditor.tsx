"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loescheProtokollVorlage, speichereProtokollVorlage } from "@/app/(app)/abnahme/vorlagen/actions";
import { EINHEITEN } from "@/lib/abnahme/edit";
import { zaehleVorlage } from "@/lib/abnahme/protokoll-vorlagen";
import { parsePunkte } from "@/lib/abnahme/vorlagen";
import type { ProtokollVorlage, Vorlage } from "@/lib/abnahme/types";

type FPos = { titel: string; einheit: string; beschreibung: string; vorlageId: string; punkteText: string };
type FRaum = { name: string; etage: string; materialText: string; positionen: FPos[] };
type Form = { id?: string; titelDe: string; titelEn: string; beschreibung: string; aktiv: boolean; sort: number; raeume: FRaum[] };

const punkteZuText = (p: { de: string; en: string }[]) => p.map((x) => (x.en && x.en !== x.de ? `${x.de} | ${x.en}` : x.de)).join("\n");

const ausVorlage = (v: ProtokollVorlage): Form => ({
  id: v.id, titelDe: v.titelDe, titelEn: v.titelEn, beschreibung: v.beschreibung, aktiv: v.aktiv, sort: v.sort,
  raeume: v.raeume.map((r) => ({
    name: r.name, etage: r.etage, materialText: r.materialText,
    positionen: r.positionen.map((p) => ({ titel: p.titel, einheit: p.einheit, beschreibung: p.beschreibung, vorlageId: p.vorlageId ?? "", punkteText: punkteZuText(p.pruefpunkte) })),
  })),
});

const leerePos = (): FPos => ({ titel: "", einheit: "Stk", beschreibung: "", vorlageId: "", punkteText: "" });

/** Protokoll-Vorlagen pflegen (CEO/Admin): Räume → Positionen → Möbeltyp-Vorlage und eigene Prüfpunkte. */
export function ProtokollVorlagenEditor({ vorlagen, moebeltypen }: { vorlagen: ProtokollVorlage[]; moebeltypen: Vorlage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const [fehler, setFehler] = useState("");

  const typName = (id: string | null) => moebeltypen.find((m) => m.id === id)?.moebeltyp;

  function setRaum(i: number, patch: Partial<FRaum>) {
    setForm((f) => (f ? { ...f, raeume: f.raeume.map((r, k) => (k === i ? { ...r, ...patch } : r)) } : f));
  }
  function setPos(i: number, j: number, patch: Partial<FPos>) {
    setForm((f) => f ? { ...f, raeume: f.raeume.map((r, k) => k === i ? { ...r, positionen: r.positionen.map((p, m) => (m === j ? { ...p, ...patch } : p)) } : r) } : f);
  }
  function tausche<T>(liste: T[], i: number, d: -1 | 1): T[] {
    const j = i + d;
    if (j < 0 || j >= liste.length) return liste;
    const n = [...liste];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  }

  function speichern() {
    if (!form) return;
    setFehler("");
    start(async () => {
      const r = await speichereProtokollVorlage({
        id: form.id, titelDe: form.titelDe, titelEn: form.titelEn, beschreibung: form.beschreibung, aktiv: form.aktiv, sort: form.sort,
        raeume: form.raeume.map((ra) => ({
          name: ra.name, etage: ra.etage, materialText: ra.materialText,
          positionen: ra.positionen.map((p) => ({ titel: p.titel, einheit: p.einheit, beschreibung: p.beschreibung, vorlageId: p.vorlageId || null, pruefpunkte: parsePunkte(p.punkteText) })),
        })),
      });
      if (r.ok) {
        setForm(null);
        router.refresh();
      } else setFehler(r.error);
    });
  }
  function loeschen(v: ProtokollVorlage) {
    if (!window.confirm(`Protokoll-Vorlage „${v.titelDe}“ löschen? Bereits angelegte Protokolle bleiben unverändert.`)) return;
    start(async () => {
      const r = await loescheProtokollVorlage(v.id);
      if (!r.ok) setFehler(r.error);
      router.refresh();
    });
  }

  return (
    <div className="abn-import">
      <ul className="aus-list">
        {vorlagen.map((v) => {
          const z = zaehleVorlage(v.raeume);
          return (
            <li key={v.id} className="aus-item">
              <div className="aus-item-main">
                <strong>{v.titelDe}</strong>{!v.aktiv && <span className="aus-muted"> · inaktiv</span>}
                <div className="aus-item-meta">
                  {z.raeume} Raum/Räume, {z.positionen} Position(en){v.beschreibung ? ` · ${v.beschreibung}` : ""}
                </div>
                <div className="aus-item-meta">
                  {v.raeume.map((r) => `${r.name}: ${r.positionen.map((p) => p.titel).join(", ") || "–"}`).join(" · ")}
                </div>
              </div>
              <div className="aus-item-side">
                <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => setForm(ausVorlage(v))}>Bearbeiten</button>
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending} onClick={() => loeschen(v)}>Löschen</button>
              </div>
            </li>
          );
        })}
        {vorlagen.length === 0 && <li className="aus-muted">Noch keine Protokoll-Vorlagen.</li>}
      </ul>
      {!form && (
        <div className="aus-actions">
          <button
            type="button"
            className="aus-btn aus-btn-primary"
            onClick={() => setForm({ titelDe: "", titelEn: "", beschreibung: "", aktiv: true, sort: (vorlagen.at(-1)?.sort ?? 0) + 10, raeume: [{ name: "", etage: "", materialText: "", positionen: [leerePos()] }] })}
          >
            Neue Protokoll-Vorlage
          </button>
        </div>
      )}
      {form && (
        <section className="aus-card">
          <h2 className="aus-h2">{form.id ? "Protokoll-Vorlage bearbeiten" : "Neue Protokoll-Vorlage"}</h2>
          <div className="aus-grid abn-kopf">
            <label className="aus-field"><span className="aus-label">Name (Deutsch) *</span>
              <input className="aus-input" value={form.titelDe} onChange={(e) => setForm({ ...form, titelDe: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Name (English)</span>
              <input className="aus-input" value={form.titelEn} onChange={(e) => setForm({ ...form, titelEn: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Reihenfolge</span>
              <input className="aus-input" inputMode="numeric" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })} /></label>
          </div>
          <label className="aus-field"><span className="aus-label">Beschreibung</span>
            <input className="aus-input" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} /></label>
          <label className="abn-inline"><input type="checkbox" checked={form.aktiv} onChange={(e) => setForm({ ...form, aktiv: e.target.checked })} /> aktiv</label>

          {form.raeume.map((ra, i) => (
            <div className="abn-raum" key={i}>
              <div className="abn-raum-kopf">
                <input className="aus-input abn-raum-name" aria-label="Raumname" placeholder="Raumname *" value={ra.name} onChange={(e) => setRaum(i, { name: e.target.value })} />
                <input className="aus-input abn-raum-etage" aria-label="Etage" placeholder="Etage" value={ra.etage} onChange={(e) => setRaum(i, { etage: e.target.value })} />
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach oben" onClick={() => setForm({ ...form, raeume: tausche(form.raeume, i, -1) })}>↑</button>
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach unten" onClick={() => setForm({ ...form, raeume: tausche(form.raeume, i, 1) })}>↓</button>
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setForm({ ...form, raeume: form.raeume.filter((_, k) => k !== i) })}>Raum löschen</button>
              </div>
              {ra.positionen.map((p, j) => (
                <div className="abn-vpos" key={j}>
                  <div className="abn-vpos-felder">
                    <input className="aus-input" aria-label="Titel" placeholder="Position (Titel) *" value={p.titel} onChange={(e) => setPos(i, j, { titel: e.target.value })} />
                    <input className="aus-input" aria-label="Einheit" list="abn-einheiten-v" placeholder="Einheit" value={p.einheit} onChange={(e) => setPos(i, j, { einheit: e.target.value })} />
                    <select className="aus-select" aria-label="Möbeltyp-Vorlage" value={p.vorlageId} onChange={(e) => setPos(i, j, { vorlageId: e.target.value })}>
                      <option value="">Ohne Möbeltyp-Vorlage</option>
                      {moebeltypen.filter((m) => m.aktiv || m.id === p.vorlageId).map((m) => <option key={m.id} value={m.id}>{m.moebeltyp}{m.aktiv ? "" : " (inaktiv)"}</option>)}
                      {p.vorlageId && !typName(p.vorlageId) && <option value={p.vorlageId}>(gelöschte Vorlage)</option>}
                    </select>
                  </div>
                  <details className="abn-langtext">
                    <summary>Eigene Prüfpunkte und Beschreibung</summary>
                    <label className="aus-field"><span className="aus-label">Zusätzliche Prüfpunkte (eine Zeile je Punkt, optional „Deutsch | English“)</span>
                      <textarea className="aus-textarea" rows={3} value={p.punkteText} onChange={(e) => setPos(i, j, { punkteText: e.target.value })} /></label>
                    <label className="aus-field"><span className="aus-label">Beschreibung</span>
                      <textarea className="aus-textarea" rows={2} value={p.beschreibung} onChange={(e) => setPos(i, j, { beschreibung: e.target.value })} /></label>
                  </details>
                  <div className="abn-vpos-btns">
                    <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Position nach oben" onClick={() => setRaum(i, { positionen: tausche(ra.positionen, j, -1) })}>↑</button>
                    <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Position nach unten" onClick={() => setRaum(i, { positionen: tausche(ra.positionen, j, 1) })}>↓</button>
                    <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setRaum(i, { positionen: ra.positionen.filter((_, k) => k !== j) })}>Position löschen</button>
                  </div>
                </div>
              ))}
              <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => setRaum(i, { positionen: [...ra.positionen, leerePos()] })}>Position hinzufügen</button>
            </div>
          ))}
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => setForm({ ...form, raeume: [...form.raeume, { name: "", etage: "", materialText: "", positionen: [leerePos()] }] })}>Raum hinzufügen</button>
          </div>
          <datalist id="abn-einheiten-v">{EINHEITEN.map((e) => <option key={e} value={e} />)}</datalist>

          {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-primary" disabled={pending || !form.titelDe.trim()} onClick={speichern}>Speichern</button>
            <button type="button" className="aus-btn aus-btn-quiet" onClick={() => { setForm(null); setFehler(""); }}>Abbrechen</button>
          </div>
        </section>
      )}
      {!form && fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
    </div>
  );
}
