"use client";

import { useRef, useState } from "react";
import { BlobImg } from "./BlobImg";
import type { Foto, Mangel } from "@/lib/abnahme/types";

export type NeuesFoto = { id: string; blob: Blob; breite: number; hoehe: number; url: string };

/** Mangel erfassen/bearbeiten: Bemerkung (Pflicht), Fotos (Kamera, lokal komprimiert), Frist (optional). */
export function MangelDialog({
  titel,
  mangel,
  fotos,
  onSave,
  onCancel,
  komprimiere,
}: {
  titel: string;
  mangel: Mangel | null;
  fotos: Foto[];
  onSave: (r: { text: string; frist: string; neueFotos: NeuesFoto[]; entfernteFotoIds: string[] }) => void;
  onCancel: () => void;
  komprimiere: (file: File) => Promise<{ blob: Blob; breite: number; hoehe: number }>;
}) {
  const [text, setText] = useState(mangel?.text ?? "");
  const [frist, setFrist] = useState(mangel?.frist ?? "");
  const [neue, setNeue] = useState<NeuesFoto[]>([]);
  const [entfernt, setEntfernt] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function dateien(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setFehler("");
    try {
      const add: NeuesFoto[] = [];
      for (const f of Array.from(list)) {
        const k = await komprimiere(f);
        add.push({ id: crypto.randomUUID(), ...k, url: URL.createObjectURL(k.blob) });
      }
      setNeue((n) => [...n, ...add]);
    } catch {
      setFehler("Das Foto konnte nicht verarbeitet werden.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const sichtbareAlte = fotos.filter((f) => !entfernt.includes(f.id));
  const anzahl = sichtbareAlte.length + neue.length;

  return (
    <div className="abn-modal" role="dialog" aria-modal="true" aria-label="Mangel">
      <div className="abn-modal-card abn-mangel-card">
        <div className="abn-mangel-kopf">
          <h2 className="abn-mangel-titel">Mangel · {titel}</h2>
          <span className="abn-muted">Bemerkung ist Pflicht</span>
        </div>
        <label className="aus-field">
          <span className="abn-caps">Bemerkung <span className="aus-req">*</span></span>
          <textarea className="aus-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>

        <div className="abn-fotos-block">
          <div className="abn-fotos-kopf">
            <span className="abn-caps">Fotos</span>
            <span className="abn-muted">{anzahl === 0 ? "noch keine" : `${anzahl} Foto${anzahl > 1 ? "s" : ""}`} · lokal komprimiert auf max. 1600 px</span>
          </div>
          <div className="abn-fotos-grid">
            {sichtbareAlte.map((f, i) => (
              <figure key={f.id} className="abn-foto-zelle">
                <BlobImg id={f.id} alt={`Foto ${i + 1} zum Mangel`} className="abn-foto" />
                <button type="button" className="abn-foto-weg" aria-label={`Foto ${i + 1} entfernen`} onClick={() => setEntfernt((x) => [...x, f.id])}>×</button>
              </figure>
            ))}
            {neue.map((f, i) => (
              <figure key={f.id} className="abn-foto-zelle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`Neues Foto ${i + 1}`} className="abn-foto" />
                <button type="button" className="abn-foto-weg" aria-label={`Neues Foto ${i + 1} entfernen`} onClick={() => setNeue((n) => n.filter((x) => x.id !== f.id))}>×</button>
              </figure>
            ))}
            <button type="button" className="abn-foto-neu" disabled={busy} onClick={() => input.current?.click()}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {busy ? "wird verarbeitet …" : "Foto aufnehmen"}
            </button>
          </div>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => dateien(e.target.files)} />
        </div>

        <label className="aus-field abn-frist">
          <span className="abn-caps">Frist zur Behebung (optional)</span>
          <input className="aus-input" type="date" value={frist} onChange={(e) => setFrist(e.target.value)} />
        </label>
        {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
        <div className="aus-actions abn-modal-actions">
          <button type="button" className="aus-btn aus-btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button
            type="button"
            className="aus-btn aus-btn-primary"
            disabled={!text.trim() || busy}
            onClick={() => onSave({ text: text.trim(), frist, neueFotos: neue, entfernteFotoIds: entfernt })}
          >
            Mangel speichern
          </button>
        </div>
      </div>
    </div>
  );
}
