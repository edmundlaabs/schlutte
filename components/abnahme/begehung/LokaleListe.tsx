"use client";

import { kommissionAnzeige } from "@/lib/abnahme/kommission";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { alleDokumente, type LokalesDokument } from "@/lib/abnahme/offline/db";
import { SYNC_EVENT, entferneLokal, gibFrei, istOnline, ladeFuerBaustelle, syncAlle, verwerfeLokal } from "@/lib/abnahme/offline/sync";
import { speicherStatus } from "@/lib/abnahme/offline/sw-register";
import { SyncBadge, useAutoSync } from "./SyncBadge";
import { SpeicherHinweis } from "./SpeicherHinweis";
import { legeRegieLokalAn } from "@/lib/abnahme/offline/regie-neu";

type ServerEintrag = {
  id: string;
  kommission_nr: string | null;
  kunde: string;
  projekt?: string | null;
  titel?: string | null;
  datum?: string | null;
  status: string;
  checkout_device: string | null;
  mitarbeiter_name: string | null;
};

export function LokaleListe() {
  const online = useAutoSync();
  const [lokal, setLokal] = useState<LokalesDokument[]>([]);
  const [server, setServer] = useState<{ protokolle: ServerEintrag[]; regieberichte: ServerEintrag[] } | null>(null);
  const [meldung, setMeldung] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [speicher, setSpeicher] = useState<{ belegt: number; quota: number; persistent: boolean } | null>(null);

  const lade = useCallback(async () => {
    setLokal(await alleDokumente());
    setSpeicher(await speicherStatus());
    if (istOnline()) {
      try {
        const res = await fetch("/api/abnahme/liste");
        if (res.ok && !res.redirected) setServer(await res.json());
      } catch {
        /* offline */
      }
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void lade());
    window.addEventListener(SYNC_EVENT, lade);
    return () => window.removeEventListener(SYNC_EVENT, lade);
  }, [lade]);

  async function laden(typ: "abnahme" | "regie", id: string, force = false) {
    setBusy(id);
    setMeldung("");
    const r = await ladeFuerBaustelle(typ, id, force);
    if (!r.ok) setMeldung(r.konflikt ? `${r.error} (Bitte erneut versuchen.)` : r.error);
    setBusy(null);
    await lade();
  }

  const [info, setInfo] = useState("");

  /**
   * Allgemeiner Abgleich: erst alle lokalen Änderungen hochladen, dann alle noch nicht geladenen offenen Dokumente
   * (die nicht auf einem anderen Gerät ausgecheckt sind) für dieses Gerät holen.
   */
  async function allesSynchronisieren() {
    setBusy("alles");
    setMeldung("");
    setInfo("");
    try {
      await syncAlle();
      const res = await fetch("/api/abnahme/liste");
      if (!res.ok || res.redirected) throw new Error("Die Liste konnte nicht geladen werden. Bitte erneut anmelden.");
      const liste = (await res.json()) as { protokolle: ServerEintrag[]; regieberichte: ServerEintrag[] };
      const vorhanden = new Set((await alleDokumente()).map((d) => d.id));
      const neue = [
        ...liste.protokolle.map((p) => ({ ...p, typ: "abnahme" as const })),
        ...liste.regieberichte.map((p) => ({ ...p, typ: "regie" as const })),
      ].filter((p) => !vorhanden.has(p.id));
      let geladen = 0;
      const fehler: string[] = [];
      if (neue.length > 0 && window.confirm(`${neue.length} Dokument(e) auf dieses Gerät laden? Sie lassen sich auch auf anderen Geräten bearbeiten; der Sync gleicht Unterschiede ab.`)) {
        for (const p of neue) {
          const r = await ladeFuerBaustelle(p.typ, p.id);
          if (r.ok) geladen++;
          else fehler.push(`${kommissionAnzeige(p.kommission_nr, "de")} · ${p.kunde}: ${r.error}`);
        }
      }
      const rest = (await alleDokumente()).filter((d) => d.dirty || d.zustand === "fehler").length;
      setInfo(`Synchronisiert: ${geladen} Dokument(e) geladen${neue.length === 0 ? " (nichts Neues auf dem Server)" : ""}${rest > 0 ? `, ${rest} mit offenen Änderungen oder Fehlern` : ", alle Änderungen hochgeladen"}.`);
      if (fehler.length) setMeldung(fehler.join(" · "));
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : "Abgleich fehlgeschlagen.");
    } finally {
      setBusy(null);
      await lade();
    }
  }

  const lokaleIds = new Set(lokal.map((d) => d.id));
  const ladbar = [
    ...(server?.protokolle ?? []).map((p) => ({ ...p, typ: "abnahme" as const })),
    ...(server?.regieberichte ?? []).map((p) => ({ ...p, typ: "regie" as const })),
  ].filter((p) => !lokaleIds.has(p.id));
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  const [neu, setNeu] = useState<{ nr: string; kunde: string; sprache: "de" | "en" } | null>(null);
  async function regieAnlegen() {
    if (!neu || !neu.nr.trim() || !neu.kunde.trim()) return setMeldung("Kommissionsnummer und Kunde sind Pflicht.");
    const id = await legeRegieLokalAn({ kommissionNr: neu.nr, kunde: neu.kunde, sprache: neu.sprache });
    window.location.href = `/abnahme/begehung?id=${id}`;
  }

  return (
    <div className="abn-liste">
      {!online && (
        <div className="aus-note" role="status"><div className="aus-note-body"><p>Kein Internet. Du kannst alle bereits geladenen Dokumente weiter bearbeiten.</p></div></div>
      )}
      {meldung && <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{meldung}</p></div></div>}
      {info && <div className="aus-note" role="status"><div className="aus-note-body"><p>{info}</p></div></div>}

      <div className="aus-actions">
        <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={!online || busy === "alles"} onClick={allesSynchronisieren}>
          {busy === "alles" ? "Synchronisiere …" : "Alles synchronisieren"}
        </button>
        <span className="aus-help">Lädt Änderungen hoch und holt alle offenen Protokolle und Regieberichte auf dieses Gerät.</span>
      </div>

      <section className="aus-card">
        <h2 className="aus-h2">Auf diesem Gerät</h2>
        {lokal.length === 0 && <p className="aus-muted">Noch nichts geladen. Mit Internet unten „Für Baustelle laden“ wählen.</p>}
        <ul className="abn-dok-liste">
          {lokal.map((d) => (
            <li key={d.id} className="abn-dok">
              <div className="abn-dok-main">
                <strong>{d.typ === "abnahme" ? "Abnahme" : "Regiebericht"} · {kommissionAnzeige(d.doc.kommissionNr, "de")}</strong> · {d.doc.kunde}
                <div className="aus-muted">
                  {d.typ === "abnahme" ? (d.doc.status === "abgeschlossen" ? "abgeschlossen" : "in Arbeit") : d.doc.status === "abgeschlossen" ? "abgeschlossen" : "Entwurf"}
                </div>
                <SyncBadge eintrag={d} online={online} />
              </div>
              <div className="abn-dok-side">
                <Link className="aus-btn aus-btn-primary" href={`/abnahme/begehung?id=${d.id}`}>Öffnen</Link>
                {d.zustand === "fehler" && /gelöscht/.test(d.fehler) && (
                  <button
                    type="button"
                    className="aus-btn aus-btn-secondary aus-btn-sm"
                    onClick={async () => {
                      if (!window.confirm("Lokale Kopie endgültig verwerfen? Nicht synchronisierte Eingaben gehen verloren.")) return;
                      await verwerfeLokal(d.id);
                      await lade();
                    }}
                  >
                    Lokal verwerfen
                  </button>
                )}
                {online && (
                  <button
                    type="button"
                    className="aus-btn aus-btn-quiet aus-btn-sm"
                    disabled={busy === d.id}
                    onClick={async () => {
                      setBusy(d.id);
                      const r = d.doc.status === "abgeschlossen" ? await entferneLokal(d.id) : await gibFrei(d.typ, d.id);
                      if (!r.ok) setMeldung(r.error ?? "Nicht möglich.");
                      setBusy(null);
                      await lade();
                    }}
                  >
                    Vom Gerät entfernen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <SpeicherHinweis />
        {speicher && (
          <p className="aus-help">
            Speicher: {mb(speicher.belegt)} MB von {mb(speicher.quota)} MB{speicher.persistent ? " · dauerhaft" : " · nicht als dauerhaft bestätigt (Schlutte am besten auf den Home-Bildschirm legen)"}
          </p>
        )}
      </section>

      <section className="aus-card">
        <h2 className="aus-h2">Neuer Regiebericht</h2>
        {!neu ? (
          <div className="aus-actions"><button type="button" className="aus-btn aus-btn-secondary" onClick={() => setNeu({ nr: "", kunde: "", sprache: "de" })}>Regiebericht anlegen</button></div>
        ) : (
          <div className="aus-grid abn-kopf">
            <label className="aus-field"><span className="aus-label">Kommission *</span>
              <input className="aus-input" inputMode="numeric" value={neu.nr} onChange={(e) => setNeu({ ...neu, nr: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Kunde *</span>
              <input className="aus-input" value={neu.kunde} onChange={(e) => setNeu({ ...neu, kunde: e.target.value })} /></label>
            <label className="aus-field"><span className="aus-label">Sprache</span>
              <select className="aus-select" value={neu.sprache} onChange={(e) => setNeu({ ...neu, sprache: e.target.value === "en" ? "en" : "de" })}><option value="de">Deutsch</option><option value="en">English</option></select></label>
            <div className="aus-actions"><button type="button" className="aus-btn aus-btn-primary" onClick={regieAnlegen}>Anlegen</button>
              <button type="button" className="aus-btn aus-btn-quiet" onClick={() => setNeu(null)}>Abbrechen</button></div>
          </div>
        )}
      </section>

      <section className="aus-card">
        <h2 className="aus-h2">Für Baustelle laden</h2>
        {!online && <p className="aus-muted">Nur mit Internet verfügbar.</p>}
        {online && ladbar.length === 0 && <p className="aus-muted">Keine weiteren offenen Dokumente.</p>}
        <ul className="abn-dok-liste">
          {ladbar.map((p) => {
            return (
              <li key={p.id} className="abn-dok">
                <div className="abn-dok-main">
                  <strong>{p.typ === "abnahme" ? "Abnahme" : "Regiebericht"} · {kommissionAnzeige(p.kommission_nr, "de")}</strong> · {p.kunde}
                  {p.titel && <span className="aus-muted"> · {p.titel}</span>}
                </div>
                <div className="abn-dok-side">
                  <button type="button" className="aus-btn aus-btn-primary" disabled={busy === p.id || !online} onClick={() => laden(p.typ, p.id)}>
                    {busy === p.id ? "Lädt …" : "Für Baustelle laden"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
