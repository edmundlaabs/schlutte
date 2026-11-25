"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildDocFromParsed } from "@/lib/abnahme/build";
import { parseProfactoPdf } from "@/lib/abnahme/parser/pdf-text";
import { setzeVorlage, suggestVorlage } from "@/lib/abnahme/vorlagen";
import { fuegePositionHinzu, fuegePruefpunktHinzu } from "@/lib/abnahme/logic";
import { ladeFuerBaustelle } from "@/lib/abnahme/offline/sync";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import type { ParsedList } from "@/lib/abnahme/parser/types";
import type { Position, ProtokollDoc, Raum, Vorlage } from "@/lib/abnahme/types";
import { findeKommissionAction, legeProtokollAn } from "@/app/(app)/abnahme/actions";
import { KundeKommissionAuswahl } from "@/components/abnahme/KundeKommissionAuswahl";
import { LEERE_AUSWAHL, wendeAuswahlAn, type KundeKommission } from "@/lib/abnahme/kommission";
import { validiereNeuesProtokoll } from "@/lib/abnahme/validate";

export function ImportWizard({
  vorlagen,
  mitarbeiter,
}: {
  vorlagen: Vorlage[];
  mitarbeiter: { id: string | null; name: string };
}) {
  const [doc, setDoc] = useState<ProtokollDoc | null>(null);
  const [parsed, setParsed] = useState<ParsedList | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kk, setKk] = useState<KundeKommission>(LEERE_AUSWAHL);
  const [zeigeAusgeblendet, setZeigeAusgeblendet] = useState(false);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [zielRaum, setZielRaum] = useState("");
  const [busy, setBusy] = useState<"" | "lesen" | "speichern">("");
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState<string | null>(null);
  const [offlineSpeichern, setOfflineSpeichern] = useState(true);
  const [offline, setOffline] = useState<"" | "laeuft" | "ok" | string>("");
  const [neuTitel, setNeuTitel] = useState<Record<string, string>>({});
  const [neuPunkt, setNeuPunkt] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const vorlageById = useMemo(() => new Map(vorlagen.map((v) => [v.id, v])), [vorlagen]);

  /** Sucht die Kommissionsnummer aus der PDF: gefunden → bestehend, sonst „neu anlegen“ mit den PDF-Daten vorbelegt. */
  async function kommissionAusPdf(nr: string, kunde: string, projekt: string): Promise<KundeKommission> {
    const clean = nr.trim();
    if (!clean) return { ...LEERE_AUSWAHL, kunde, projekt };
    const t = await findeKommissionAction(clean);
    if (t) return { modus: "bestehend", commissionId: t.id, nr: t.nr, kunde: t.kunde || kunde, projekt: projekt || t.projekt };
    return { modus: /^\d{6}$/.test(clean) ? "neu" : "bestehend", commissionId: null, nr: /^\d{6}$/.test(clean) ? clean : "", kunde, projekt };
  }

  async function dateiGewaehlt(f: File | null) {
    if (!f) return;
    setFehler("");
    setFertig(null);
    setBusy("lesen");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const data = new Uint8Array(await f.arrayBuffer());
      const result = await parseProfactoPdf(data, pdfjs as never);
      const neu = buildDocFromParsed(result, vorlagen, {
        id: crypto.randomUUID(),
        mitarbeiterId: mitarbeiter.id,
        mitarbeiterName: mitarbeiter.name,
      });
      setParsed(result);
      setDoc(neu);
      setFile(f);
      setAuswahl(new Set());
      setKk(await kommissionAusPdf(neu.kommissionNr, neu.kunde, neu.projekt));
    } catch (e) {
      console.error(e);
      setFehler("Die PDF konnte nicht gelesen werden. Ist es die Profacto-Liste „Einfache Positionsliste“?");
    } finally {
      setBusy("");
    }
  }

  function update(patch: Partial<ProtokollDoc>) {
    setDoc((d) => (d ? { ...d, ...patch } : d));
  }
  function updateRaum(id: string, patch: Partial<Raum>) {
    setDoc((d) => (d ? { ...d, raeume: d.raeume.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : d));
  }
  function updatePos(id: string, patch: Partial<Position>) {
    setDoc((d) => (d ? { ...d, positionen: d.positionen.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : d));
  }
  function neuerRaum() {
    setDoc((d) => {
      if (!d) return d;
      const r: Raum = { id: crypto.randomUUID(), sort: d.raeume.length, name: "Neuer Raum", etage: "", materialText: "", bemerkung: "" };
      return { ...d, raeume: [...d.raeume, r] };
    });
  }
  function raumLoeschen(id: string) {
    setDoc((d) =>
      d
        ? {
            ...d,
            raeume: d.raeume.filter((r) => r.id !== id).map((r, i) => ({ ...r, sort: i })),
            positionen: d.positionen.map((p) => (p.raumId === id ? { ...p, raumId: null } : p)),
          }
        : d
    );
  }
  function raumVerschieben(id: string, richtung: -1 | 1) {
    setDoc((d) => {
      if (!d) return d;
      const i = d.raeume.findIndex((r) => r.id === id);
      const j = i + richtung;
      if (i < 0 || j < 0 || j >= d.raeume.length) return d;
      const liste = [...d.raeume];
      [liste[i], liste[j]] = [liste[j], liste[i]];
      return { ...d, raeume: liste.map((r, k) => ({ ...r, sort: k })) };
    });
  }
  function auswahlVerschieben() {
    if (!doc || !zielRaum || auswahl.size === 0) return;
    setDoc({ ...doc, positionen: doc.positionen.map((p) => (auswahl.has(p.id) ? { ...p, raumId: zielRaum } : p)) });
    setAuswahl(new Set());
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
      setDoc((d) => (d ? { ...d, positionen: d.positionen.map((x) => (x.id === p.id ? { ...setzeVorlage(x, v), relevant } : x)) } : d));
    } else {
      updatePos(p.id, { relevant });
    }
  }

  const probleme = doc ? validiereNeuesProtokoll(doc, kk) : [];

  async function speichern() {
    if (!doc || !file || probleme.length) return;
    setBusy("speichern");
    setFehler("");
    const supabase = createClient();
    const pfad = `protokoll/${doc.id}/original.pdf`;
    try {
      const up = await supabase.storage.from("abnahme").upload(pfad, file, { contentType: "application/pdf", upsert: true });
      if (up.error) throw new Error(`Original-PDF konnte nicht abgelegt werden: ${up.error.message}`);
      const res = await legeProtokollAn({ ...wendeAuswahlAn(doc, kk), originalPath: pfad }, { kommission: kk.modus, quelle: "profacto" });
      if (!res.ok) {
        await supabase.storage.from("abnahme").remove([pfad]);
        throw new Error(res.error);
      }
      setFertig(res.data.id);
      // Sofort auf diesem Gerät offline ablegen (auschecken, Daten und App-Shell lokal speichern).
      if (offlineSpeichern) {
        setOffline("laeuft");
        await registriereAbnahmeSw();
        const l = await ladeFuerBaustelle("abnahme", res.data.id);
        setOffline(l.ok ? "ok" : l.error);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy("");
    }
  }

  if (fertig) {
    return (
      <div className="aus-card abn-done">
        <h2 className="aus-h2">Protokoll angelegt</h2>
        <p>{kk.modus === "ohne" ? "Ohne Kommission" : `Kommission ${kk.nr}`} · {kk.kunde}.</p>
        {offline === "laeuft" && <p className="aus-muted">Wird für die Baustelle auf diesem Gerät gespeichert …</p>}
        {offline === "ok" && <p className="aus-field-ok" role="status">Auf diesem Gerät offline gespeichert. Die Begehung funktioniert jetzt auch ohne Internet.</p>}
        {offline !== "" && offline !== "laeuft" && offline !== "ok" && (
          <p className="aus-field-error" role="alert">Nicht offline gespeichert: {offline} Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>
        )}
        {offline === "" && <p className="aus-muted">Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>}
        <div className="aus-actions">
          <Link className="aus-btn aus-btn-primary" href={`/abnahme/begehung?id=${fertig}`}>Zur Begehung</Link>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme">Zur Ablage</Link>
          <button type="button" className="aus-btn aus-btn-quiet" onClick={() => { setDoc(null); setParsed(null); setFile(null); setFertig(null); }}>
            Weitere PDF importieren
          </button>
        </div>
      </div>
    );
  }

  const ausgeblendetAnzahl = doc?.positionen.filter((p) => !p.relevant).length ?? 0;
  const gruppen: { raum: Raum | null; positionen: Position[] }[] = doc
    ? [
        ...doc.raeume.map((r) => ({ raum: r, positionen: doc.positionen.filter((p) => p.raumId === r.id) })),
        ...(doc.positionen.some((p) => !p.raumId) ? [{ raum: null, positionen: doc.positionen.filter((p) => !p.raumId) }] : []),
      ]
    : [];

  return (
    <div className="abn-import">
      <section className="aus-card abn-drop">
        <h2 className="aus-h2">1 · PDF wählen</h2>
        {doc && (
          <div className="aus-actions">
            <button
              type="button"
              className="aus-btn aus-btn-quiet"
              onClick={() => {
                if (!window.confirm("Import verwerfen? Es wurde noch nichts angelegt.")) return;
                setDoc(null); setParsed(null); setFile(null); setKk(LEERE_AUSWAHL); setFehler("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Import verwerfen
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="aus-input"
          onChange={(e) => dateiGewaehlt(e.target.files?.[0] ?? null)}
        />
        {busy === "lesen" && <p className="aus-muted">PDF wird gelesen …</p>}
        {fehler && !doc && <p className="aus-field-error" role="alert">{fehler}</p>}
      </section>

      {doc && parsed && (
        <>
          {parsed.warnings.length > 0 && (
            <div className="aus-note" role="status">
              <div className="aus-note-body">
                <p className="aus-note-title">Hinweise zum Lesen der Liste</p>
                <ul>{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
          )}

          <section className="aus-card">
            <h2 className="aus-h2">2 · Kunde, Kommission und Kopf</h2>
            <KundeKommissionAuswahl
              value={kk}
              onChange={setKk}
              hinweisKunde="Profacto schneidet den Namen ab – bitte vollständig eintragen."
            />
            <div className="aus-grid abn-kopf">
              <label className="aus-field">
                <span className="aus-label">Baustellenadresse / Ort</span>
                <input className="aus-input" value={doc.ort} onChange={(e) => update({ ort: e.target.value })} />
              </label>
              <label className="aus-field">
                <span className="aus-label">Bezeichnung (z. B. Teilabnahme EG)</span>
                <input className="aus-input" value={doc.titel} onChange={(e) => update({ titel: e.target.value })} />
              </label>
              <label className="aus-field">
                <span className="aus-label">Sprache des Protokolls</span>
                <select className="aus-select" value={doc.sprache} onChange={(e) => update({ sprache: e.target.value === "en" ? "en" : "de" })}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="aus-field">
                <span className="aus-label">Kunden-E-Mail (optional, für automatischen Versand)</span>
                <input className="aus-input" type="email" inputMode="email" value={doc.kundeEmail} onChange={(e) => update({ kundeEmail: e.target.value })} />
              </label>
            </div>
          </section>

          <section className="aus-card">
            <div className="aus-card-head">
              <h2 className="aus-h2">3 · Räume und Positionen</h2>
              <Link className="aus-btn aus-btn-quiet aus-btn-sm" href="/abnahme/vorlagen" target="_blank">Prüfpunkt-Vorlagen pflegen</Link>
              <div className="aus-head-actions">
                {ausgeblendetAnzahl > 0 && (
                  <label className="abn-inline">
                    <input type="checkbox" checked={zeigeAusgeblendet} onChange={(e) => setZeigeAusgeblendet(e.target.checked)} />
                    Ausgeblendete zeigen ({ausgeblendetAnzahl})
                  </label>
                )}
                <button type="button" className="aus-btn aus-btn-secondary aus-btn-sm" onClick={neuerRaum}>Raum hinzufügen</button>
              </div>
            </div>

            <div className="abn-move">
              <span>{auswahl.size} ausgewählt</span>
              <select className="aus-select" value={zielRaum} onChange={(e) => setZielRaum(e.target.value)} aria-label="Zielraum">
                <option value="">Verschieben nach …</option>
                {doc.raeume.map((r) => (
                  <option key={r.id} value={r.id}>{r.etage ? `${r.etage} · ` : ""}{r.name}</option>
                ))}
              </select>
              <button type="button" className="aus-btn aus-btn-primary aus-btn-sm" disabled={!zielRaum || auswahl.size === 0} onClick={auswahlVerschieben}>
                Verschieben
              </button>
            </div>

            {gruppen.map(({ raum, positionen }) => {
              const sichtbar = positionen.filter((p) => p.relevant || zeigeAusgeblendet);
              return (
                <div className="abn-raum" key={raum?.id ?? "ohne"}>
                  {raum ? (
                    <div className="abn-raum-kopf">
                      <input className="aus-input abn-raum-name" aria-label="Raumname" value={raum.name} onChange={(e) => updateRaum(raum.id, { name: e.target.value })} />
                      <input className="aus-input abn-raum-etage" aria-label="Etage" placeholder="Etage (EG/OG …)" value={raum.etage} onChange={(e) => updateRaum(raum.id, { etage: e.target.value })} />
                      <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach oben" onClick={() => raumVerschieben(raum.id, -1)}>↑</button>
                      <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" aria-label="Raum nach unten" onClick={() => raumVerschieben(raum.id, 1)}>↓</button>
                      {positionen.length === 0 && (
                        <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => raumLoeschen(raum.id)}>Löschen</button>
                      )}
                    </div>
                  ) : (
                    <div className="abn-raum-kopf"><strong>Ohne Raum</strong><span className="aus-muted"> – nur ausgeblendete Positionen dürfen hier bleiben</span></div>
                  )}
                  {raum && raum.materialText && (
                    <details className="abn-material">
                      <summary>Materialangaben</summary>
                      <textarea className="aus-textarea" rows={4} value={raum.materialText} onChange={(e) => updateRaum(raum.id, { materialText: e.target.value })} />
                    </details>
                  )}
                  {sichtbar.length === 0 && <p className="aus-muted abn-leer">Keine Positionen.</p>}
                  {raum && (
                    <div className="abn-punkt-neu">
                      <input className="aus-input" placeholder="Eigene Position hinzufügen …" value={neuTitel[raum.id] ?? ""} onChange={(e) => setNeuTitel({ ...neuTitel, [raum.id]: e.target.value })} />
                      <button
                        type="button"
                        className="aus-btn aus-btn-secondary"
                        disabled={!(neuTitel[raum.id] ?? "").trim()}
                        onClick={() => {
                          const titel = (neuTitel[raum.id] ?? "").trim();
                          const v = suggestVorlage(titel, vorlagen);
                          setDoc((d) => (d ? fuegePositionHinzu(d, raum.id, { titel, menge: "1", einheit: "Stk", vorlageId: v?.id ?? null, pruefpunkte: v?.punkte }) : d));
                          setNeuTitel({ ...neuTitel, [raum.id]: "" });
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
                          <div className="abn-pos-title">
                            <span className="aus-mono">{p.nr}</span> {p.titel}
                            {(p.menge || p.einheit) && <span className="aus-muted"> · {p.menge} {p.einheit}</span>}
                          </div>
                          {p.relevant && (
                            <>
                              {p.pruefpunkte.length > 0 && <div className="aus-muted abn-leer">{p.pruefpunkte.map((k) => k.textDe).join(" · ")}</div>}
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
                                    setDoc((d) => (d ? fuegePruefpunktHinzu(d, p.id, text) : d));
                                    setNeuPunkt({ ...neuPunkt, [p.id]: "" });
                                  }}
                                >
                                  Hinzufügen
                                </button>
                              </div>
                            </>
                          )}
                          {p.langtext && (
                            <details className="abn-langtext">
                              <summary>Langtext</summary>
                              <pre>{p.langtext}</pre>
                            </details>
                          )}
                        </div>
                        <div className="abn-pos-side">
                          {p.relevant ? (
                            <>
                              <select
                                className="aus-select"
                                aria-label="Prüfpunkte"
                                value={p.vorlageId ?? ""}
                                onChange={(e) => setDoc((d) => d ? { ...d, positionen: d.positionen.map((x) => x.id === p.id ? setzeVorlage(x, vorlageById.get(e.target.value) ?? null) : x) } : d)}
                              >
                                <option value="">Nur als Ganzes abnehmen</option>
                                {vorlagen.filter((v) => v.aktiv).map((v) => (
                                  <option key={v.id} value={v.id}>{v.titelDe} ({v.punkte.length})</option>
                                ))}
                              </select>
                              <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => relevantSetzen(p, false)}>Ausblenden</button>
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
          </section>

          <section className="aus-card">
            <h2 className="aus-h2">4 · Anlegen</h2>
            {probleme.length > 0 && <ul className="aus-field-error">{probleme.map((p) => <li key={p}>{p}</li>)}</ul>}
            {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
            <p className="aus-muted">Das Original-PDF wird zusätzlich im Protokoll abgelegt.</p>
            <label className="abn-inline">
              <input type="checkbox" checked={offlineSpeichern} onChange={(e) => setOfflineSpeichern(e.target.checked)} />
              Gleich auf diesem Gerät offline speichern (für die Baustelle)
            </label>
            <p className="aus-help">Das Protokoll ist dann auf diesem Gerät ausgecheckt. Für ein anderes Tablet bitte abwählen und dort „Für Baustelle laden“ nutzen.</p>
            <div className="aus-actions">
              <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={busy === "speichern" || probleme.length > 0} onClick={speichern}>
                {busy === "speichern" ? "Wird angelegt …" : "Abnahmeprotokoll anlegen"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
