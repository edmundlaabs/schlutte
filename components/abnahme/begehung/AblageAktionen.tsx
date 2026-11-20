"use client";

import { useState } from "react";
import { abnahmeDateiname } from "@/lib/abnahme/filename";
import type { LokalesDokument } from "@/lib/abnahme/offline/db";
import { holePdfBlob, speicherePdfLokal } from "@/lib/abnahme/pdf/lokal";
import { teileOderLadeHerunter } from "@/lib/abnahme/offline/download";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

/** Aktionen am abgeschlossenen Protokoll: PDF ansehen, herunterladen (auch offline). Senden/Nachtrag: Schritt 6. */
export function AblageAktionen({ eintrag }: { eintrag: Abnahme; online: boolean; onAendereEintrag: (fn: (e: Abnahme) => Abnahme) => void }) {
  const doc = eintrag.doc;
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const name = abnahmeDateiname(doc.kommissionNr, doc.kunde, doc.abgeschlossenAt ?? new Date());

  async function pdf(): Promise<Blob> {
    const b = await holePdfBlob(doc.id);
    if (b) return b;
    await speicherePdfLokal(doc);
    return (await holePdfBlob(doc.id))!;
  }
  async function ansehen() {
    setBusy(true);
    setFehler("");
    try {
      window.open(URL.createObjectURL(await pdf()), "_blank");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.");
    } finally {
      setBusy(false);
    }
  }
  async function laden() {
    setBusy(true);
    setFehler("");
    try {
      await teileOderLadeHerunter(await pdf(), name);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Download fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aus-card">
      <h3 className="aus-card-title">PDF</h3>
      <p className="aus-muted">{name}</p>
      {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
      <div className="aus-actions">
        <button type="button" className="aus-btn aus-btn-secondary" disabled={busy} onClick={ansehen}>PDF ansehen</button>
        <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={laden}>Herunterladen / Teilen</button>
      </div>
    </div>
  );
}
