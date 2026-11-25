"use client";

import { useMemo, useState } from "react";
import { aktion, berechneAenderungen, standardWahl, type Aenderung, type Seite, type Wahlen } from "@/lib/abnahme/abgleich";
import type { LokalesDokument } from "@/lib/abnahme/offline/db";
import { berechneRegieAenderungen } from "@/lib/abnahme/regie-abgleich";
import type { ProtokollDoc, RegieDoc } from "@/lib/abnahme/types";
import { wendeAbgleichAn } from "@/lib/abnahme/offline/sync";


const AKTION_TEXT = { hinzufuegen: "wird hinzugefügt", ersetzen: "wird ersetzt", loeschen: "wird gelöscht" } as const;
const VON_TEXT = { lokal: "nur auf diesem Gerät geändert", server: "nur auf dem Server geändert", beide: "auf beiden Seiten geändert (Konflikt)" } as const;

/**
 * Abgleich nach einem Sync, bei dem der Server-Stand vom letzten gemeinsamen Stand abweicht (anderes Gerät oder Büro
 * hat parallel geändert). Alle Unterschiede sind aufgelistet; je Eintrag wählt der Nutzer den Stand dieses Geräts oder
 * den Server-Stand – daraus wird zusammengefügt, ersetzt oder gelöscht. Beide Stände werden danach archiviert.
 */
export function AbgleichDialog({ eintrag, onClose }: { eintrag: LokalesDokument; onClose: () => void }) {
  const konflikt = eintrag.konflikt;
  const abgeschlossen = eintrag.doc.status === "abgeschlossen";
  const liste = useMemo<Aenderung[]>(
    () => {
      if (!konflikt) return [];
      return eintrag.typ === "abnahme"
        ? berechneAenderungen(eintrag.basis, eintrag.doc, konflikt.server as ProtokollDoc)
        : berechneRegieAenderungen(eintrag.basis, eintrag.doc, konflikt.server as RegieDoc);
    },
    [eintrag, konflikt]
  );
  const [wahlen, setWahlen] = useState<Wahlen>(() => Object.fromEntries(liste.map((a) => [a.key, standardWahl(a)])));
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  if (!konflikt) return null;

  const wahl = (a: Aenderung): Seite => wahlen[a.key] ?? standardWahl(a);
  const gruppen = Array.from(new Set(liste.map((a) => a.gruppe)));
  const konflikte = liste.filter((a) => a.von === "beide").length;

  function alle(seite: Seite) {
    setWahlen(Object.fromEntries(liste.map((a) => [a.key, seite])));
  }

  async function anwenden(ganzerTabletStand = false) {
    setBusy(true);
    setFehler("");
    const r = await wendeAbgleichAn(eintrag.id, wahlen, ganzerTabletStand);
    setBusy(false);
    if (r.ok) onClose();
    else setFehler(r.error ?? "Abgleich fehlgeschlagen.");
  }

  return (
    <div className="abn-modal" role="dialog" aria-modal="true" aria-label="Abgleich">
      <div className="abn-modal-card abn-abgleich">
        <h2 className="aus-h2">Abgleich: zwei verschiedene Stände</h2>
        <p className="aus-muted">
          {eintrag.typ === "abnahme" ? "Dieses Protokoll" : "Dieser Regiebericht"} wurde seit dem letzten Abgleich auch an anderer Stelle geändert. Wähle je Eintrag, welcher Stand gilt.
          Beide Stände werden danach im Protokoll archiviert, nichts geht verloren.
        </p>
        {liste.length === 0 ? (
          <p>Es gibt keine inhaltlichen Unterschiede. Die Stände werden nur auf die aktuelle Version gebracht.</p>
        ) : (
          <>
            <div className="abn-abgleich-kopf">
              <strong>{liste.length} Unterschied(e){konflikte > 0 ? `, davon ${konflikte} Konflikt(e)` : ""}</strong>
              <span className="abn-vorlage-zeile">
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => alle("lokal")}>Alle: dieses Gerät</button>
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => alle("server")}>Alle: Server</button>
              </span>
            </div>
            {gruppen.map((g) => (
              <section key={g} className="abn-abgleich-gruppe">
                <h3 className="aus-card-title">{g}</h3>
                <ul className="abn-abgleich-liste">
                  {liste.filter((a) => a.gruppe === g).map((a) => {
                    const w = wahl(a);
                    return (
                      <li key={a.key} className={a.von === "beide" ? "is-konflikt" : undefined}>
                        <div className="abn-abgleich-titel"><strong>{a.titel}</strong> <span className="aus-muted">· {VON_TEXT[a.von]}</span></div>
                        <div className="abn-abgleich-werte">
                          <div className={w === "lokal" ? "is-gewaehlt" : undefined}><span className="abn-caps">Dieses Gerät</span><div>{a.lokal ?? "nicht vorhanden"}</div></div>
                          <div className={w === "server" ? "is-gewaehlt" : undefined}><span className="abn-caps">Server</span><div>{a.server ?? "nicht vorhanden"}</div></div>
                        </div>
                        <div className="abn-seg" role="radiogroup" aria-label={`Auswahl: ${a.titel}`}>
                          {(["lokal", "server"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              role="radio"
                              aria-checked={w === s}
                              disabled={abgeschlossen}
                              className={w === s ? "abn-seg-btn is-on" : "abn-seg-btn"}
                              onClick={() => setWahlen({ ...wahlen, [a.key]: s })}
                            >
                              {s === "lokal" ? "Dieses Gerät" : "Server"}
                            </button>
                          ))}
                        </div>
                        <span className="aus-help">Ergebnis: {AKTION_TEXT[aktion(a, w)]}.</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
        {abgeschlossen && (
          <p className="aus-field-error">
            {eintrag.typ === "abnahme" ? "Dieses Protokoll" : "Dieser Regiebericht"} ist hier bereits abgeschlossen und das PDF erzeugt. Es kann nur als Ganzes übernommen werden; der Server-Stand
            bleibt archiviert.
          </p>
        )}
        {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
        <div className="aus-actions abn-modal-actions">
          <button type="button" className="aus-btn aus-btn-quiet" disabled={busy} onClick={onClose}>Später</button>
          {abgeschlossen ? (
            <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={() => anwenden(true)}>
              {busy ? "Wird abgeglichen …" : "Stand dieses Geräts übernehmen"}
            </button>
          ) : (
            <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={() => anwenden()}>
              {busy ? "Wird abgeglichen …" : "Abgleichen und speichern"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
