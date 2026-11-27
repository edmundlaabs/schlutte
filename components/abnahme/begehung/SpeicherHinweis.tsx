"use client";

import { useCallback, useEffect, useState } from "react";
import { alleDokumente } from "@/lib/abnahme/offline/db";
import { FOTO_EVENT, ausstehendeOriginale } from "@/lib/abnahme/offline/fotos";
import { SYNC_EVENT } from "@/lib/abnahme/offline/sync";
import { speicherStatus } from "@/lib/abnahme/offline/sw-register";
import { speicherKnapp } from "@/lib/abnahme/speicher";

const MB = 1024 * 1024;
/**
 * Speicherplatz und Upload-Status der Originalfotos. Mit `docId`: nur dieses Protokoll, sonst alle auf dem Gerät.
 */
export function SpeicherHinweis({ docId }: { docId?: string }) {
  const [s, setS] = useState<{ belegt: number; quota: number } | null>(null);
  const [offen, setOffen] = useState(0);
  const [hoch, setHoch] = useState(0);

  const lade = useCallback(async () => {
    setS(await speicherStatus());
    let o = 0;
    let h = 0;
    for (const d of await alleDokumente()) {
      if (d.typ !== "abnahme" || (docId && d.id !== docId)) continue;
      o += (await ausstehendeOriginale(d.id)).length;
      h += [...d.doc.fotos, ...(d.doc.objektFotos ?? [])].filter((f) => f.pathOriginal).length;
    }
    setOffen(o);
    setHoch(h);
  }, [docId]);

  useEffect(() => {
    queueMicrotask(() => void lade());
    window.addEventListener(FOTO_EVENT, lade);
    window.addEventListener(SYNC_EVENT, lade);
    return () => {
      window.removeEventListener(FOTO_EVENT, lade);
      window.removeEventListener(SYNC_EVENT, lade);
    };
  }, [lade]);

  const knapp = speicherKnapp(s);
  if (!knapp && offen === 0) return null;
  return (
    <div className={`abn-speicher${knapp ? " is-warn" : ""}`} role={knapp ? "alert" : "status"}>
      {knapp && s && (
        <span>
          Speicher knapp: {Math.round((s.quota - s.belegt) / MB)} MB frei. Originalfotos belegen 2–5 MB je Foto; bitte synchronisieren und fertige Protokolle vom Gerät entfernen.
        </span>
      )}
      {offen > 0 && <span> Originale: {hoch} / {hoch + offen} hochgeladen (lädt im Hintergrund, App offen lassen).</span>}
    </div>
  );
}
