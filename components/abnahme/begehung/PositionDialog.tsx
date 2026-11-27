"use client";

import { useEffect, useState } from "react";
import { ladeVorlagenLokal } from "@/lib/abnahme/offline/store";
import type { Position, Vorlage } from "@/lib/abnahme/types";

export type NeuePosition = { titel: string; menge: string; einheit: string; langtext: string; vorlageId: string | null; pruefpunkte: { de: string; en?: string }[] };

export type PositionDaten = { nr: string; titel: string; menge: string; einheit: string; langtext: string };

/** Position anlegen (Titel, Menge, Prüfpunkte aus Vorlage und/oder frei) oder – mit `bestehend` – nur ihre Stammdaten ändern. */
export function PositionDialog({ raumName, bestehend, onSave, onSaveDaten, onCancel }: {
  raumName: string;
  bestehend?: Position;
  onSave?: (p: NeuePosition) => void;
  onSaveDaten?: (p: PositionDaten) => void;
  onCancel: () => void;
}) {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([]);
  const [nr, setNr] = useState(bestehend?.nr ?? "");
  const [titel, setTitel] = useState(bestehend?.titel ?? "");
  const [menge, setMenge] = useState(bestehend ? bestehend.menge : "1");
  const [einheit, setEinheit] = useState(bestehend ? bestehend.einheit : "Stk");
  const [langtext, setLangtext] = useState(bestehend?.langtext ?? "");
  const [vorlageId, setVorlageId] = useState("");
  const [frei, setFrei] = useState("");
  useEffect(() => {
    void ladeVorlagenLokal().then(setVorlagen);
  }, []);

  function speichern() {
    if (bestehend) {
      onSaveDaten?.({ nr: nr.trim(), titel: titel.trim(), menge: menge.trim(), einheit: einheit.trim(), langtext: langtext.trim() });
      return;
    }
    const v = vorlagen.find((x) => x.id === vorlageId);
    const punkte = [
      ...(v ? v.punkte : []),
      ...frei.split("\n").map((z) => z.trim()).filter(Boolean).map((z) => ({ de: z, en: z })),
    ];
    onSave?.({ titel: titel.trim(), menge: menge.trim(), einheit: einheit.trim(), langtext: langtext.trim(), vorlageId: v?.id ?? null, pruefpunkte: punkte });
  }

  return (
    <div className="abn-modal" role="dialog" aria-modal="true" aria-label={bestehend ? "Position bearbeiten" : "Position hinzufügen"}>
      <div className="abn-modal-card">
        <h2 className="aus-h2">{bestehend ? "Position bearbeiten" : "Position hinzufügen"} · {raumName}</h2>
        {bestehend && (
          <label className="aus-field"><span className="aus-label">Nr.</span>
            <input className="aus-input" value={nr} onChange={(e) => setNr(e.target.value)} /></label>
        )}
        <label className="aus-field"><span className="aus-label">Titel *</span>
          <input className="aus-input" value={titel} onChange={(e) => setTitel(e.target.value)} autoFocus /></label>
        <div className="abn-maße">
          <label className="aus-field"><span className="aus-label">Menge</span>
            <input className="aus-input" value={menge} onChange={(e) => setMenge(e.target.value)} /></label>
          <label className="aus-field"><span className="aus-label">Einheit</span>
            <input className="aus-input" value={einheit} onChange={(e) => setEinheit(e.target.value)} /></label>
        </div>
        <label className="aus-field"><span className="aus-label">Beschreibung (optional)</span>
          <textarea className="aus-textarea" rows={2} value={langtext} onChange={(e) => setLangtext(e.target.value)} /></label>
        {!bestehend && (<>
        <label className="aus-field"><span className="aus-label">Prüfpunkte aus Vorlage</span>
          <select className="aus-select" value={vorlageId} onChange={(e) => setVorlageId(e.target.value)}>
            <option value="">Keine Vorlage</option>
            {vorlagen.filter((v) => v.aktiv).map((v) => <option key={v.id} value={v.id}>{v.titelDe} ({v.punkte.length})</option>)}
          </select></label>
        <label className="aus-field"><span className="aus-label">Weitere eigene Prüfpunkte (eine Zeile je Punkt)</span>
          <textarea className="aus-textarea" rows={3} value={frei} onChange={(e) => setFrei(e.target.value)} /></label>
        </>)}
        <div className="aus-actions abn-modal-actions">
          <button type="button" className="aus-btn aus-btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="aus-btn aus-btn-primary" disabled={!titel.trim()} onClick={speichern}>{bestehend ? "Speichern" : "Position anlegen"}</button>
        </div>
      </div>
    </div>
  );
}
