"use client";

import { useRef, useState } from "react";
import { BlobImg } from "./BlobImg";
import type { Foto, Mangel } from "@/lib/abnahme/types";

export type NeuesFoto = { id: string; blob: Blob; breite: number; hoehe: number; url: string };

/** Mangel erfassen/bearbeiten: Bemerkung (Pflicht), Frist (optional), Fotos (Kamera, lokal komprimiert). */
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

  return (
    <div className="abn-modal" role="dialog" aria-modal="true" aria-label="Mangel">
      <div className="abn-modal-card">
        <h2 className="aus-h2">Mangel: {titel}</h2>
        <label className="aus-field">
          <span className="aus-label">Bemerkung <span className="aus-req">*</span></span>
          <textarea className="aus-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
        <label className="aus-field">
          <span className="aus-label">Frist zur Behebung (optional)</span>
          <input className="aus-input" type="date" value={frist} onChange={(e) => setFrist(e.target.value)} />
        </label>
        <div className="abn-fotos">
          {sichtbareAlte.map((f) => (
            <figure key={f.id}>
              <BlobImg id={f.id} alt="Foto zum Mangel" className="abn-foto" />
              <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setEntfernt((x) => [...x, f.id])}>Entfernen</button>
            </figure>
          ))}
          {neue.map((f) => (
            <figure key={f.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="Neues Foto" className="abn-foto" />
              <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setNeue((n) => n.filter((x) => x.id !== f.id))}>Entfernen</button>
            </figure>
          ))}
        </div>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => dateien(e.target.files)} />
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Foto wird verarbeitet …" : "Foto aufnehmen / wählen"}
          </button>
        </div>
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
