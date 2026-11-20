"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Unterschriftsfeld (Canvas, Pointer Events). Speichert PNG mit transparentem Grund.
 * Dialog mit Name; Ergebnis kommt als Blob zurück, Zeitstempel setzt der Aufrufer.
 */
export function SignaturePad({
  titel,
  vorschlagName,
  rolle,
  onSave,
  onCancel,
}: {
  titel: string;
  vorschlagName: string;
  rolle: string;
  onSave: (r: { blob: Blob; name: string }) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const [leer, setLeer] = useState(true);
  const [name, setName] = useState(vorschlagName);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#101a3a";
    }
  }, []);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = punkt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    setLeer(false);
  }
  function bewege(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = punkt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function ende() {
    zeichnet.current = false;
  }
  function loeschen() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setLeer(true);
  }
  function speichern() {
    canvasRef.current!.toBlob((blob) => {
      if (blob && name.trim()) onSave({ blob, name: name.trim() });
    }, "image/png");
  }

  return (
    <div className="abn-modal" role="dialog" aria-modal="true" aria-label={titel}>
      <div className="abn-modal-card">
        <h2 className="aus-h2">{titel}</h2>
        <label className="aus-field">
          <span className="aus-label">Name der unterschreibenden Person ({rolle})</span>
          <input className="aus-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <canvas
          ref={canvasRef}
          className="abn-sig"
          onPointerDown={start}
          onPointerMove={bewege}
          onPointerUp={ende}
          onPointerCancel={ende}
          aria-label="Unterschriftsfeld"
        />
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-quiet" onClick={loeschen} disabled={leer}>Löschen / Neu</button>
          <button type="button" className="aus-btn aus-btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="aus-btn aus-btn-primary" onClick={speichern} disabled={leer || !name.trim()}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}
