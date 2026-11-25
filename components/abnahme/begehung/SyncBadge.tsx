"use client";

import { useEffect, useState } from "react";
import { alleDokumente, type LokalesDokument } from "@/lib/abnahme/offline/db";
import { SYNC_EVENT, istOnline, syncAlle, syncDokument } from "@/lib/abnahme/offline/sync";
import { AbgleichDialog } from "./AbgleichDialog";

/** Startet den Sync automatisch, sobald Internet da ist (online-Ereignis, Sichtbarwerden, Intervall). */
export function useAutoSync() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const aktualisiere = () => {
      setOnline(istOnline());
      if (istOnline()) void syncAlle();
    };
    aktualisiere();
    window.addEventListener("online", aktualisiere);
    window.addEventListener("offline", aktualisiere);
    document.addEventListener("visibilitychange", aktualisiere);
    const t = window.setInterval(aktualisiere, 30000);
    return () => {
      window.removeEventListener("online", aktualisiere);
      window.removeEventListener("offline", aktualisiere);
      document.removeEventListener("visibilitychange", aktualisiere);
      window.clearInterval(t);
    };
  }, []);
  return online;
}

export function SyncBadge({ eintrag, online }: { eintrag: LokalesDokument | null; online: boolean }) {
  const [busy, setBusy] = useState(false);
  const [abgleich, setAbgleich] = useState(false);
  if (!eintrag) return null;
  const konflikt = Boolean(eintrag.konflikt) && !eintrag.archiv;
  const text = konflikt
    ? "Abgleich nötig"
    : eintrag.zustand === "fehler" ? "Sync-Fehler" : eintrag.dirty || eintrag.zustand === "lokal" ? "lokal gespeichert" : "synchronisiert";
  const klasse = konflikt || eintrag.zustand === "fehler" ? "is-error" : eintrag.dirty ? "is-local" : "is-ok";
  return (
    <span className="abn-sync">
      {konflikt && (
        <>
          <button type="button" className="aus-btn aus-btn-primary aus-btn-sm" onClick={() => setAbgleich(true)}>Abgleichen</button>
          {abgleich && <AbgleichDialog eintrag={eintrag} onClose={() => setAbgleich(false)} />}
        </>
      )}
      <span className={`abn-badge ${klasse}`} title={eintrag.fehler || undefined}>{text}</span>
      {!online && <span className="abn-badge is-offline">offline</span>}
      {online && !konflikt && (eintrag.dirty || eintrag.zustand !== "synchronisiert") && (
        <button
          type="button"
          className="aus-btn aus-btn-quiet aus-btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await syncDokument(eintrag.id);
            setBusy(false);
          }}
        >
          {busy ? "…" : "Jetzt synchronisieren"}
        </button>
      )}
    </span>
  );
}

/** Anzahl lokaler Dokumente mit offenen Änderungen (für Hinweisbanner). */
export function useUngesynct(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const lade = async () => setN((await alleDokumente()).filter((d) => d.dirty || d.zustand !== "synchronisiert").length);
    void lade();
    window.addEventListener(SYNC_EVENT, lade);
    const t = window.setInterval(lade, 5000);
    return () => {
      window.removeEventListener(SYNC_EVENT, lade);
      window.clearInterval(t);
    };
  }, []);
  return n;
}
