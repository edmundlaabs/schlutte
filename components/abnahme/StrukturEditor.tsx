"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  aendereRaum, aenderePosition, aenderePruefpunkt, EINHEITEN, loeschePosition, loeschePruefpunktEntwurf, loescheRaum,
  neuePosition, neuerRaum, verschiebePositionen, verschiebeRaum,
} from "@/lib/abnahme/edit";
import { fuegePruefpunktHinzu } from "@/lib/abnahme/logic";
import { setzeVorlage, suggestVorlage } from "@/lib/abnahme/vorlagen";
import type { Position, ProtokollDoc, Raum, Vorlage } from "@/lib/abnahme/types";

/**
 * Räume, Positionen und Prüfpunkte bearbeiten – gemeinsam für den Profacto-Import und den manuellen Editor.
 * - modus "import": Positionen aus der PDF (Titel/Menge fix), ausblenden/aufnehmen, Langtext lesen.
 * - modus "manuell": Positionen vollständig editierbar, Löschen von Positionen und Räumen.
 */
export function StrukturEditor({
  doc,
  setDoc,
  vorlagen,
  modus,
  kopfAktionen,
}: {
  doc: ProtokollDoc;
  setDoc: (f: (d: ProtokollDoc) => ProtokollDoc) => void;
  vorlagen: Vorlage[];
  modus: "import" | "manuell";
  /** Zusätzliche Schaltflächen rechts im Kartenkopf (z. B. „Aus Vorlage einfügen“). */
  kopfAktionen?: ReactNode;
}) {
  const manuell = modus === "manuell";
  const [zeigeAusgeblendet, setZeigeAusgeblendet] = useState(false);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [zielRaum, setZielRaum] = useState("");
  const [neuTitel, setNeuTitel] = useState<Record<string, string>>({});
  const [neuPunkt, setNeuPunkt] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState("");
  const vorlageById = useMemo(() => new Map(vorlagen.map((v) => [v.id, v])), [vorlagen]);

  const ausgeblendetAnzahl = doc.positionen.filter((p) => !p.relevant).length;
  const gruppen: { raum: Raum | null; positionen: Position[] }[] = [
    ...doc.raeume.map((r) => ({ raum: r, positionen: doc.positionen.filter((p) => p.raumId === r.id) })),
    ...(doc.positionen.some((p) => !p.raumId) ? [{ raum: null, positionen: doc.positionen.filter((p) => !p.raumId) }] : []),
  ];

  function versuche(f: () => void) {
    setFehler("");
    try {
      f();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Nicht möglich.");
    }
  }
  function toggle(id: string) {
    setAuswahl((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function relevantSetzen(p: Position, relevant: boolean) {
    // Beim Aufnehmen einer ausgeblendeten Position passende Prüfpunkte vorschlagen.
    if (relevant && !p.vorlageId && p.pruefpunkte.length === 0) {
      const v = suggestVorlage(p.titel, vorlagen);
      setDoc((d) => ({ ...d, positionen: d.positionen.map((x) => (x.id === p.id ? { ...setzeVorlage(x, v), relevant } : x)) }));
    } else {
      setDoc((d) => aenderePosition(d, p.id, { relevant }));
    }
  }
  function raumEntfernen(raum: Raum, anzahl: number) {
    if (manuell && anzahl > 0 && !window.confirm(`Raum „${raum.name}“ mit ${anzahl} Position${anzahl === 1 ? "" : "en"} löschen?`)) return;
    setDoc((d) => loescheRaum(d, raum.id, manuell ? "entfernen" : "loesen"));
  }

  return (
    <section className="aus-card">
      <div className="aus-card-head">
        <h2 className="aus-h2">Räume und Positionen</h2>
        <Link className="aus-btn aus-btn-quiet aus-btn-sm" href="/abnahme/vorlagen" target="_blank">Vorlagen pflegen</Link>
        <div className="aus-head-actions">
          {ausgeblendetAnzahl > 0 && (
            <label className="abn-inline">
              <input type="checkbox" checked={zeigeAusgeblendet} onChange={(e) => setZeigeAusgeblendet(e.target.checked)} />
              Ausgeblendete zeigen ({ausgeblendetAnzahl})
            </label>
          )}
          {kopfAktionen}
          <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => setDoc((d) => neuerRaum(d).doc)}>Raum hinzufügen</button>
        </div>
      </div>
      {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}

      {doc.positionen.length > 0 && (
        <div className="abn-move">
          <span>{auswahl.size} ausgewählt</span>
          <select className="aus-select" value={zielRaum} onChange={(e) => setZielRaum(e.target.value)} aria-label="Zielraum">
            <option value="">Verschieben nach …</option>
            {doc.raeume.map((r) => (
              <option key={r.id} value={r.id}>{r.etage ? `${r.etage} · ` : ""}{r.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="aus-btn aus-btn-primary aus-btn-sm"
            disabled={!zielRaum || auswahl.size === 0}
            onClick={() => {
              setDoc((d) => verschiebePositionen(d, auswahl, zielRaum));
              setAuswahl(new Set());
            }}
          >
            Verschieben
          </button>
        </div>
      )}

      {manuell && doc.raeume.length === 0 && (
        <p className="aus-muted abn-leer">Noch kein Raum. Mit „Raum hinzufügen“ beginnen oder „Aus Vorlage einfügen“ nutzen.</p>
      )}

      {gruppen.map(({ raum, positionen }) => {
        const sichtbar = positionen.filter((p) => p.relevant || zeigeAusgeblendet);
        return (
          <div className="abn-raum" key={raum?.id ?? "ohne"}>
            {raum ? (
              <div className="abn-raum-kopf">
                <input className="aus-input abn-raum-name" aria-label="Raumname" value={raum.name} onChange={(e) => setDoc((d) => aendereRaum(d, raum.id, { name: e.target.value }))} />
                <input className="aus-input abn-raum-etage" aria-label="Etage" placeholder="Etage (EG/OG …)" value={raum.etage} onChange={(e) => setDoc((d) => aendereRaum(d, raum.id, { etage: e.target.value }))} />
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach oben" onClick={() => setDoc((d) => verschiebeRaum(d, raum.id, -1))}>↑</button>
                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach unten" onClick={() => setDoc((d) => verschiebeRaum(d, raum.id, 1))}>↓</button>
                {(manuell || positionen.length === 0) && (
                  <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => raumEntfernen(raum, positionen.length)}>Löschen</button>
                )}
              </div>
            ) : (
              <div className="abn-raum-kopf"><strong>Ohne Raum</strong><span className="aus-muted"> – nur ausgeblendete Positionen dürfen hier bleiben</span></div>
            )}
            {raum && (manuell || raum.materialText) && (
              <details className="abn-material">
                <summary>Materialangaben</summary>
                <textarea className="aus-textarea" rows={3} value={raum.materialText} onChange={(e) => setDoc((d) => aendereRaum(d, raum.id, { materialText: e.target.value }))} />
              </details>
            )}
            {sichtbar.length === 0 && <p className="aus-muted abn-leer">Keine Positionen.</p>}
            {raum && (
              <div className="abn-punkt-neu">
                <input
                  className="aus-input"
                  placeholder="Position hinzufügen …"
                  value={neuTitel[raum.id] ?? ""}
                  onChange={(e) => setNeuTitel({ ...neuTitel, [raum.id]: e.target.value })}
                />
                <button
                  type="button"
                  className="aus-btn aus-btn-secondary"
                  disabled={!(neuTitel[raum.id] ?? "").trim()}
                  onClick={() => {
                    const titel = (neuTitel[raum.id] ?? "").trim();
                    const v = suggestVorlage(titel, vorlagen);
                    versuche(() => {
                      setDoc((d) =>
                        neuePosition(d, raum.id, { titel, menge: "1", einheit: "Stk", vorlageId: v?.id ?? null, pruefpunkte: v?.punkte }).doc
                      );
                      setNeuTitel({ ...neuTitel, [raum.id]: "" });
                    });
                  }}
                >
                  Position hinzufügen
                </button>
              </div>
            )}
            <ul className="abn-pos-list">
              {sichtbar.map((p) => (
                <li key={p.id} className={p.relevant ? "abn-pos" : "abn-pos is-hidden"}>
                  <label className="abn-check">
                    <input type="checkbox" checked={auswahl.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Position ${p.nr} auswählen`} />
                  </label>
                  <div className="abn-pos-main">
                    {manuell ? (
                      <div className="abn-pos-felder">
                        <input className="aus-input abn-pos-nr" aria-label="Nr." value={p.nr} onChange={(e) => setDoc((d) => aenderePosition(d, p.id, { nr: e.target.value }))} />
                        <input className="aus-input abn-pos-titel" aria-label="Titel" placeholder="Titel *" value={p.titel} onChange={(e) => setDoc((d) => aenderePosition(d, p.id, { titel: e.target.value }))} />
                        <input className="aus-input abn-pos-menge" aria-label="Menge" inputMode="decimal" placeholder="Menge" value={p.menge} onChange={(e) => setDoc((d) => aenderePosition(d, p.id, { menge: e.target.value }))} />
                        <input
                          className="aus-input abn-pos-einheit"
                          aria-label="Einheit"
                          placeholder="Einheit"
                          list="abn-einheiten"
                          value={p.einheit}
                          onChange={(e) => setDoc((d) => aenderePosition(d, p.id, { einheit: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div className="abn-pos-title">
                        <span className="aus-mono">{p.nr}</span> {p.titel}
                        {(p.menge || p.einheit) && <span className="aus-muted"> · {p.menge} {p.einheit}</span>}
                      </div>
                    )}
                    {p.relevant && (
                      <>
                        {p.pruefpunkte.length > 0 && (
                          <ul className="abn-pp-list">
                            {p.pruefpunkte.map((k) => (
                              <li key={k.id}>
                                <input
                                  className="aus-input"
                                  aria-label="Prüfpunkt"
                                  value={k.textDe}
                                  onChange={(e) => setDoc((d) => aenderePruefpunkt(d, p.id, k.id, { textDe: e.target.value, textEn: k.textEn === k.textDe ? e.target.value : k.textEn }))}
                                />
                                <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label={`Prüfpunkt „${k.textDe}“ löschen`} onClick={() => setDoc((d) => loeschePruefpunktEntwurf(d, p.id, k.id))}>×</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="abn-punkt-neu">
                          <input
                            className="aus-input"
                            placeholder="Eigenen Prüfpunkt hinzufügen …"
                            value={neuPunkt[p.id] ?? ""}
                            onChange={(e) => setNeuPunkt({ ...neuPunkt, [p.id]: e.target.value })}
                          />
                          <button
                            type="button"
                            className="aus-btn aus-btn-secondary aus-btn-sm"
                            disabled={!(neuPunkt[p.id] ?? "").trim()}
                            onClick={() => {
                              const text = (neuPunkt[p.id] ?? "").trim();
                              versuche(() => {
                                setDoc((d) => fuegePruefpunktHinzu(d, p.id, text));
                                setNeuPunkt({ ...neuPunkt, [p.id]: "" });
                              });
                            }}
                          >
                            Hinzufügen
                          </button>
                        </div>
                      </>
                    )}
                    {manuell ? (
                      <details className="abn-langtext">
                        <summary>Beschreibung{p.langtext ? " ✓" : ""}</summary>
                        <textarea className="aus-textarea" rows={3} value={p.langtext} onChange={(e) => setDoc((d) => aenderePosition(d, p.id, { langtext: e.target.value }))} />
                      </details>
                    ) : (
                      p.langtext && (
                        <details className="abn-langtext">
                          <summary>Langtext</summary>
                          <pre>{p.langtext}</pre>
                        </details>
                      )
                    )}
                  </div>
                  <div className="abn-pos-side">
                    {p.relevant ? (
                      <>
                        <select
                          className="aus-select"
                          aria-label="Möbeltyp-Vorlage"
                          value={p.vorlageId ?? ""}
                          onChange={(e) => setDoc((d) => ({ ...d, positionen: d.positionen.map((x) => (x.id === p.id ? setzeVorlage(x, vorlageById.get(e.target.value) ?? null) : x)) }))}
                        >
                          <option value="">Nur als Ganzes abnehmen</option>
                          {vorlagen.filter((v) => v.aktiv || v.id === p.vorlageId).map((v) => (
                            <option key={v.id} value={v.id}>{v.titelDe} ({v.punkte.length})</option>
                          ))}
                        </select>
                        {manuell ? (
                          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setDoc((d) => loeschePosition(d, p.id))}>Löschen</button>
                        ) : (
                          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => relevantSetzen(p, false)}>Ausblenden</button>
                        )}
                      </>
                    ) : (
                      <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={() => relevantSetzen(p, true)}>Aufnehmen</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <datalist id="abn-einheiten">
        {EINHEITEN.map((e) => <option key={e} value={e} />)}
      </datalist>
    </section>
  );
}
