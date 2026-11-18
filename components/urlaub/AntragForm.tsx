"use client";

import { useMemo, useState } from "react";
import { antragStellenAction } from "@/app/(app)/urlaub/actions";
import { Meldung, useAktion } from "./useAktion";
import { tageProTag } from "@/lib/urlaub/tage";
import { tageText, zeitraumText, istISO } from "@/lib/urlaub/datum";
import { ueberschneiden } from "@/lib/urlaub/datum";
import { ART_LABEL, type ArbeitsmusterEintrag, type Betriebsferien, type Sperre } from "@/lib/urlaub/types";

/**
 * Formular „Urlaub beantragen“. Die Live-Anzeige rechnet mit denselben Funktionen wie der Server;
 * maßgeblich ist aber die serverseitige Berechnung beim Speichern.
 */
export function AntragForm({
  muster,
  ferien,
  sperren,
  restNachBeantragt,
}: {
  muster: ArbeitsmusterEintrag[];
  ferien: Betriebsferien[];
  sperren: Sperre[];
  /** Rest des Jahres nach allen offenen Anträgen (für „Rest danach“). */
  restNachBeantragt: number;
}) {
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState("urlaub");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [halbStart, setHalbStart] = useState(false);
  const [halbEnde, setHalbEnde] = useState(false);
  const { pending, result, ausfuehren, setResult } = useAktion();

  const bisEff = bis || von;
  const gueltig = istISO(von) && istISO(bisEff) && bisEff >= von;

  const analyse = useMemo(() => {
    if (!gueltig) return null;
    const tage = tageProTag({ von, bis: bisEff, halbtagStart: halbStart, halbtagEnde: halbEnde, muster, betriebsferien: ferien });
    const feiertage = tage.filter((t) => t.grund === "feiertag").map((t) => t.feiertag).filter(Boolean) as string[];
    return {
      summe: tage.reduce((s, t) => s + t.wert, 0),
      feiertage: [...new Set(feiertage)],
      sperren: sperren.filter((s) => ueberschneiden(s, { von, bis: bisEff })),
      ferien: ferien.filter((f) => ueberschneiden(f, { von, bis: bisEff })),
    };
  }, [gueltig, von, bisEff, halbStart, halbEnde, muster, ferien, sperren]);

  if (!offen) {
    return (
      <div className="aus-actions">
        <button type="button" className="aus-btn aus-btn-primary" onClick={() => setOffen(true)}>Urlaub beantragen</button>
        <button type="button" className="aus-btn aus-btn-quiet urlaub-krank" disabled aria-disabled="true">Krankmeldung – kommt später</button>
      </div>
    );
  }

  return (
    <form
      className="urlaub-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        ausfuehren(() => antragStellenAction(fd), () => {
          setOffen(false);
          setVon(""); setBis(""); setHalbStart(false); setHalbEnde(false); setArt("urlaub");
        });
      }}
    >
      <div className="aus-field">
        <label className="aus-label" htmlFor="u-art">Art</label>
        <select id="u-art" name="art" className="aus-select" value={art} onChange={(e) => setArt(e.target.value)}>
          <option value="urlaub">{ART_LABEL.urlaub}</option>
          <option value="ueberstunden">{ART_LABEL.ueberstunden}</option>
          <option value="sonder">{ART_LABEL.sonder}</option>
          <option value="krank" disabled>{ART_LABEL.krank} – kommt später</option>
        </select>
        {art !== "urlaub" && <span className="aus-help">Wird genehmigt, zählt aber nicht gegen dein Urlaubskonto.</span>}
      </div>

      <div className="urlaub-dates">
        <div className="aus-field">
          <label className="aus-label" htmlFor="u-von">Von<span className="aus-req">*</span></label>
          <input id="u-von" name="von" type="date" className="aus-input" required value={von}
            onChange={(e) => { setVon(e.target.value); if (!bis || bis < e.target.value) setBis(e.target.value); }} />
        </div>
        <div className="aus-field">
          <label className="aus-label" htmlFor="u-bis">Bis<span className="aus-req">*</span></label>
          <input id="u-bis" name="bis" type="date" className="aus-input" required min={von || undefined} value={bis} onChange={(e) => setBis(e.target.value)} />
        </div>
      </div>

      <div className="aus-field">
        <label className="aus-check"><input type="checkbox" name="halbtag_start" checked={halbStart} onChange={(e) => setHalbStart(e.target.checked)} /> Erster Tag nur halber Tag</label>
        <label className="aus-check"><input type="checkbox" name="halbtag_ende" checked={halbEnde} onChange={(e) => setHalbEnde(e.target.checked)} /> Letzter Tag nur halber Tag</label>
      </div>

      {analyse && (
        <>
          <div className="urlaub-live" aria-live="polite">
            <strong>{tageText(analyse.summe)}</strong>
            <span>{analyse.summe === 1 ? "Arbeitstag" : "Arbeitstage"} · {zeitraumText(von, bisEff)}</span>
          </div>
          <ul className="urlaub-hinweise">
            {analyse.summe === 0 && <li className="is-warn">Im Zeitraum liegen keine Arbeitstage.</li>}
            {art === "urlaub" && analyse.summe > 0 && (
              <li>Resturlaub danach: {tageText(restNachBeantragt - analyse.summe)} Tage{restNachBeantragt - analyse.summe < 0 ? " (mehr als dein Konto – die Geschäftsleitung entscheidet)" : ""}.</li>
            )}
            {analyse.feiertage.length > 0 && <li>Feiertage zählen nicht mit: {analyse.feiertage.join(", ")}.</li>}
            {analyse.ferien.map((f) => (
              <li key={f.id}>Betriebsferien „{f.titel}“{f.zaehlt_als_urlaub ? ": diese Tage werden dir automatisch als Urlaub abgezogen." : ": diese Tage zählen nicht."}</li>
            ))}
            {analyse.sperren.map((s) => <li key={s.id} className="is-warn">In diesem Zeitraum ist eine Urlaubssperre: {s.titel}.</li>)}
          </ul>
        </>
      )}

      <div className="aus-field">
        <label className="aus-label" htmlFor="u-kommentar">Kommentar (optional)</label>
        <textarea id="u-kommentar" name="kommentar" className="aus-textarea" rows={3} maxLength={500} />
      </div>

      <Meldung result={result} />
      <div className="aus-actions">
        <button type="submit" className="aus-btn aus-btn-primary" disabled={pending || !gueltig}>{pending ? "Wird gesendet …" : "Antrag stellen"}</button>
        <button type="button" className="aus-btn aus-btn-quiet" onClick={() => { setOffen(false); setResult(null); }}>Abbrechen</button>
      </div>
    </form>
  );
}
