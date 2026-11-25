"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { holeDokument } from "@/lib/abnahme/offline/db";
import { ladeFuerBaustelle } from "@/lib/abnahme/offline/sync";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";

/**
 * Protokoll bzw. Regiebericht hier (PC oder Tablet) bearbeiten: lädt den Stand auf dieses Gerät und öffnet die
 * Bearbeitung (Begehung). Es gibt kein Auschecken; bei abweichenden Ständen gleicht der Sync ab.
 */
export function BearbeitenButton({ typ, id, label = "Bearbeiten" }: { typ: "abnahme" | "regie"; id: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function los() {
    setBusy(true);
    setFehler("");
    try {
      await registriereAbnahmeSw();
      // Ist das Dokument schon auf diesem Gerät, nichts überschreiben (ungesicherte Eingaben bleiben erhalten).
      if (!(await holeDokument(id))) {
        const r = await ladeFuerBaustelle(typ, id);
        if (!r.ok) throw new Error(r.error);
      }
      router.push(`/abnahme/begehung?id=${id}`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={los}>{busy ? "Wird geladen …" : label}</button>
      {fehler && <span className="aus-field-error" role="alert">{fehler}</span>}
    </>
  );
}
