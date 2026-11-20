"use client";

import { useState } from "react";
import { abnahmeDateiname } from "@/lib/abnahme/filename";
import type { LokalesDokument } from "@/lib/abnahme/offline/db";
import { holePdfBlob, speicherePdfLokal } from "@/lib/abnahme/pdf/lokal";
import { teileOderLadeHerunter } from "@/lib/abnahme/offline/download";
import { fuehreVersandAus } from "@/lib/abnahme/offline/versand";
import { syncDokument } from "@/lib/abnahme/offline/sync";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

/** Aktionen am abgeschlossenen Protokoll: PDF ansehen/herunterladen (auch offline), Senden/Erneut senden. */
export function AblageAktionen({
  eintrag, online, onAendereEintrag,
}: { eintrag: Abnahme; online: boolean; onAendereEintrag: (fn: (e: Abnahme) => Abnahme) => void }) {
  const doc = eintrag.doc;
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [info, setInfo] = useState("");
  const [an, setAn] = useState(doc.kundeEmail);
  const [kopie, setKopie] = useState(doc.kopieEmail);
  const name = abnahmeDateiname(doc.kommissionNr, doc.kunde, doc.abgeschlossenAt ?? new Date());
  const synchron = !eintrag.dirty && eintrag.zustand === "synchronisiert";

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
  async function senden() {
    setFehler("");
    setInfo("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim())) {
      setFehler("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    const schluessel = `manuell:${crypto.randomUUID()}`;
    onAendereEintrag((e) => ({ ...e, versand: [...e.versand, { an: an.trim(), kopie: kopie.trim(), schluessel }] }));
    if (online) {
      setBusy(true);
      // Erst synchronisieren (PDF muss am Server liegen), dann Versand ausführen.
      const s = synchron ? { ok: true } : await syncDokument(doc.id);
      if (s.ok) {
        const r = await fuehreVersandAus(doc.id);
        if (r.gesendet > 0) setInfo("Gesendet.");
        else setFehler(r.fehler || "Versand fehlgeschlagen – bleibt vorgemerkt.");
      } else {
        setInfo("Vorgemerkt: wird nach dem Synchronisieren gesendet.");
      }
      setBusy(false);
    } else {
      setInfo("Offline: Versand ist vorgemerkt und wird nach dem Synchronisieren gesendet.");
    }
  }

  return (
    <>
      <div className="aus-card">
        <h3 className="aus-card-title">PDF</h3>
        <p className="aus-muted">{name}</p>
        {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-secondary" disabled={busy} onClick={ansehen}>PDF ansehen</button>
          <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={laden}>Herunterladen / Teilen</button>
        </div>
        <p className="aus-help">iPad: Teilen-Menü → „In Dateien sichern“. Android: Download-Ordner.</p>
      </div>
      <div className="aus-card">
        <h3 className="aus-card-title">An Kunden senden</h3>
        <div className="aus-grid abn-kopf">
          <label className="aus-field">
            <span className="aus-label">E-Mail Kunde</span>
            <input className="aus-input" type="email" inputMode="email" value={an} onChange={(e) => setAn(e.target.value)} />
          </label>
          <label className="aus-field">
            <span className="aus-label">Zusätzliche Kopie (optional)</span>
            <input className="aus-input" type="email" inputMode="email" value={kopie} onChange={(e) => setKopie(e.target.value)} />
          </label>
        </div>
        {eintrag.versand.length > 0 && (
          <p className="aus-muted">Vorgemerkt ({eintrag.versand.length}): {eintrag.versand.map((v) => v.an).join(", ")} – wird nach dem Synchronisieren gesendet.</p>
        )}
        {info && <p className="aus-field-ok" role="status">{info}</p>}
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={senden}>Senden / Erneut senden</button>
        </div>
      </div>
    </>
  );
}
