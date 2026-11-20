"use client";

import { useState } from "react";
import { regieDateiname } from "@/lib/abnahme/filename";
import { halbeStunden, neueZeile, nummeriere, regieKannAbschliessen, ROLLEN, STD_KEYS, summen, type Rolle } from "@/lib/abnahme/regie-logic";
import { regieSignaturBlobId } from "@/lib/abnahme/offline/regie-laden";
import { speichereBlob } from "@/lib/abnahme/offline/db";
import { useLokalesRegie } from "@/lib/abnahme/offline/store";
import { syncDokument } from "@/lib/abnahme/offline/sync";
import { fuehreVersandAus } from "@/lib/abnahme/offline/versand";
import { teileOderLadeHerunter } from "@/lib/abnahme/offline/download";
import type { RegieDoc, RegieZeile } from "@/lib/abnahme/types";
import { SignaturePad } from "../SignaturePad";
import { BlobImg } from "./BlobImg";
import { SyncBadge, useAutoSync } from "./SyncBadge";

const heute = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Stepper({ wert, onChange, disabled, label }: { wert: number; onChange: (n: number) => void; disabled: boolean; label: string }) {
  return (
    <div className="abn-stepper" role="group" aria-label={label}>
      <span className="abn-stepper-label">{label}</span>
      <button type="button" className="abn-st" disabled={disabled || wert <= 0} onClick={() => onChange(halbeStunden(wert - 0.5))} aria-label={`${label} weniger`}>−</button>
      <output className="abn-stepper-wert">{String(wert).replace(".", ",")}</output>
      <button type="button" className="abn-st" disabled={disabled} onClick={() => onChange(halbeStunden(wert + 0.5))} aria-label={`${label} mehr`}>+</button>
    </div>
  );
}

export function RegieEditor({ id }: { id: string }) {
  const online = useAutoSync();
  const { eintrag, doc, laedt, aendere, aendereEintrag } = useLokalesRegie(id);
  const [sig, setSig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [info, setInfo] = useState("");
  const [an, setAn] = useState("");
  const [geoeffnetAm] = useState(() => Date.now());

  if (laedt) return <p className="aus-muted">Wird geladen …</p>;
  if (!eintrag || !doc) return <div className="aus-note" role="alert"><div className="aus-note-body"><p>Dieser Regiebericht ist auf diesem Gerät nicht gespeichert.</p></div></div>;
  const d: RegieDoc = doc;
  const gesperrt = d.status === "abgeschlossen";
  const sum = summen(d.zeilen);
  const pruefung = regieKannAbschliessen(d);
  const dateiname = regieDateiname(d.kommissionNr, d.kunde, d.anerkanntAt ?? d.datum);

  const setze = (patch: Partial<RegieDoc>) => aendere((x) => ({ ...x, ...patch }));
  const setzeZeile = (zid: string, patch: Partial<RegieZeile>) => aendere((x) => ({ ...x, zeilen: x.zeilen.map((z) => (z.id === zid ? { ...z, ...patch } : z)) }));

  async function unterschriftSpeichern(r: { blob: Blob; name: string }) {
    await speichereBlob({ id: regieSignaturBlobId(d.id), docId: d.id, art: "unterschrift", mime: "image/png", blob: r.blob, hochgeladen: false });
    setze({ unterschriftName: r.name, unterschriftPath: null });
    setSig(false);
  }

  async function abschliessen() {
    if (!pruefung.ok) return;
    if (!window.confirm("Regiebericht jetzt abschließen? Danach ist er gesperrt.")) return;
    setBusy(true);
    setFehler("");
    try {
      const geschlossen: RegieDoc = { ...d, status: "abgeschlossen", anerkanntAt: new Date().toISOString() };
      const { speichereRegiePdfLokal } = await import("@/lib/abnahme/pdf/lokal");
      await speichereRegiePdfLokal(geschlossen);
      aendere(() => geschlossen);
      if (geschlossen.kundeEmail.trim()) {
        aendereEintrag((e) => ({ ...e, versand: [...e.versand, { an: geschlossen.kundeEmail.trim(), kopie: geschlossen.kopieEmail.trim(), schluessel: `abschluss:${geschlossen.id}` }] }));
      }
    } catch (e) {
      console.error(e);
      setFehler(e instanceof Error ? e.message : "Abschluss fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function pdfBlob(): Promise<Blob> {
    const { holePdfBlob, speichereRegiePdfLokal } = await import("@/lib/abnahme/pdf/lokal");
    const b = await holePdfBlob(d.id);
    if (b) return b;
    await speichereRegiePdfLokal(d);
    return (await holePdfBlob(d.id))!;
  }
  async function vorschau() {
    setBusy(true);
    setFehler("");
    try {
      const { erzeugeRegiePdfLokal } = await import("@/lib/abnahme/pdf/lokal");
      const bytes = gesperrt ? null : await erzeugeRegiePdfLokal(d);
      const blob = bytes ? new Blob([bytes as BlobPart], { type: "application/pdf" }) : await pdfBlob();
      window.open(URL.createObjectURL(blob), "_blank");
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
      await teileOderLadeHerunter(await pdfBlob(), dateiname);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Download fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function senden() {
    setFehler("");
    setInfo("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim())) return setFehler("Bitte eine gültige E-Mail-Adresse eingeben.");
    aendereEintrag((e) => ({ ...e, versand: [...e.versand, { an: an.trim(), kopie: d.kopieEmail.trim(), schluessel: `manuell:${crypto.randomUUID()}` }] }));
    if (!online) return setInfo("Offline: Versand ist vorgemerkt und wird nach dem Synchronisieren gesendet.");
    setBusy(true);
    const s = !eintrag!.dirty && eintrag!.zustand === "synchronisiert" ? { ok: true } : await syncDokument(d.id);
    if (s.ok) {
      const r = await fuehreVersandAus(d.id);
      if (r.gesendet > 0) setInfo("Gesendet.");
      else setFehler(r.fehler || "Versand fehlgeschlagen – bleibt vorgemerkt.");
    } else setInfo("Vorgemerkt: wird nach dem Synchronisieren gesendet.");
    setBusy(false);
  }

  return (
    <div className="abn-begehung">
      <header className="abn-bar">
        <div className="abn-bar-title"><span className="aus-mono">{d.kommissionNr}</span> · {d.kunde} <span className="aus-muted">· Regiebericht</span></div>
        <SyncBadge eintrag={eintrag} online={online} />
      </header>
      {gesperrt && <div className="aus-note" role="status"><div className="aus-note-body"><p>Dieser Regiebericht ist abgeschlossen und gesperrt.</p></div></div>}

      <section className="aus-card">
        <h2 className="aus-h2">Kopf</h2>
        <div className="aus-grid abn-kopf">
          <label className="aus-field"><span className="aus-label">Kommission *</span>
            <input className="aus-input" inputMode="numeric" disabled={gesperrt} value={d.kommissionNr} onChange={(e) => setze({ kommissionNr: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Kunde *</span>
            <input className="aus-input" disabled={gesperrt} value={d.kunde} onChange={(e) => setze({ kunde: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Name</span>
            <input className="aus-input" disabled={gesperrt} value={d.name} onChange={(e) => setze({ name: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Straße</span>
            <input className="aus-input" disabled={gesperrt} value={d.strasse} onChange={(e) => setze({ strasse: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Ort</span>
            <input className="aus-input" disabled={gesperrt} value={d.ort} onChange={(e) => setze({ ort: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Telefon</span>
            <input className="aus-input" type="tel" inputMode="tel" disabled={gesperrt} value={d.telefon} onChange={(e) => setze({ telefon: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Datum</span>
            <input className="aus-input" type="date" disabled={gesperrt} value={d.datum} onChange={(e) => setze({ datum: e.target.value })} /></label>
          <label className="aus-field"><span className="aus-label">Sprache</span>
            <select className="aus-select" disabled={gesperrt} value={d.sprache} onChange={(e) => setze({ sprache: e.target.value === "en" ? "en" : "de" })}>
              <option value="de">Deutsch</option><option value="en">English</option></select></label>
          <div className="aus-field"><span className="aus-label">Durchführender Mitarbeiter</span><div className="abn-readonly">{d.mitarbeiterName || "—"}</div></div>
        </div>
        <label className="aus-field"><span className="aus-label">Auftragsbeschreibung</span>
          <textarea className="aus-textarea" rows={3} disabled={gesperrt} value={d.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value })} /></label>
      </section>

      <section className="aus-card">
        <h2 className="aus-h2">Ausgeführte Arbeiten</h2>
        <ul className="abn-pos-liste">
          {d.zeilen.map((z) => (
            <li key={z.id} className="abn-pos-karte">
              <div className="abn-pos-kopf">
                <strong className="aus-mono">Pos. {z.pos}</strong>
                <input className="aus-input" type="date" disabled={gesperrt} value={z.datum} onChange={(e) => setzeZeile(z.id, { datum: e.target.value })} aria-label="Datum" />
                {!gesperrt && (
                  <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => aendere((x) => ({ ...x, zeilen: nummeriere(x.zeilen.filter((y) => y.id !== z.id)) }))}>Zeile löschen</button>
                )}
              </div>
              <label className="aus-field"><span className="aus-label">Beschreibung / Material</span>
                <textarea className="aus-textarea" rows={2} disabled={gesperrt} value={z.text} onChange={(e) => setzeZeile(z.id, { text: e.target.value })} /></label>
              <div className="abn-maße">
                {(["menge", "laenge", "breite", "staerke"] as const).map((k) => (
                  <label className="aus-field" key={k}><span className="aus-label">{{ menge: "Menge", laenge: "Länge", breite: "Breite", staerke: "Stärke" }[k]}</span>
                    <input className="aus-input" disabled={gesperrt} value={z[k]} onChange={(e) => setzeZeile(z.id, { [k]: e.target.value })} /></label>
                ))}
                <label className="aus-field"><span className="aus-label">km einfach</span>
                  <input className="aus-input" inputMode="decimal" disabled={gesperrt} value={z.km ?? ""} onChange={(e) => { const v = e.target.value.replace(",", "."); setzeZeile(z.id, { km: v === "" || Number.isNaN(Number(v)) ? null : Number(v) }); }} /></label>
              </div>
              <div className="abn-rollen">
                {ROLLEN.map((r) => (
                  <Stepper key={r} label={r} disabled={gesperrt} wert={z[STD_KEYS[r]]} onChange={(n) => setzeZeile(z.id, { [STD_KEYS[r]]: n })} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        {!gesperrt && (
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-secondary aus-btn-lg" onClick={() => aendere((x) => ({ ...x, zeilen: [...x.zeilen, neueZeile(x, heute())] }))}>Zeile hinzufügen</button>
          </div>
        )}
        <div className="abn-summen" aria-label="Summen">
          {(ROLLEN as readonly Rolle[]).map((r) => <span key={r} className="abn-chip">{r} {String(sum[r]).replace(".", ",")} h</span>)}
          <span className="abn-chip is-ok">Gesamt {String(sum.gesamt).replace(".", ",")} h</span>
        </div>
      </section>

      <section className="aus-card">
        <h2 className="aus-h2">Abschluss</h2>
        <p>anerkannt, den {new Date(d.anerkanntAt ?? geoeffnetAm).toLocaleDateString("de-DE")}</p>
        <div className="abn-sig-zeile">
          <strong>Unterschrift Kunde</strong>
          {d.unterschriftName ? <span className="abn-sig-ok"><BlobImg id={regieSignaturBlobId(d.id)} alt="Unterschrift Kunde" className="abn-sig-img" /> {d.unterschriftName}</span> : <span className="aus-muted">fehlt</span>}
          {!gesperrt && <button type="button" className="aus-btn aus-btn-secondary" onClick={() => setSig(true)}>{d.unterschriftName ? "Neu" : "Unterschreiben"}</button>}
        </div>
        {!gesperrt && (
          <>
            <label className="aus-field"><span className="aus-label">Kunden-E-Mail (optional, automatischer Versand nach Sync)</span>
              <input className="aus-input" type="email" inputMode="email" value={d.kundeEmail} onChange={(e) => setze({ kundeEmail: e.target.value })} /></label>
            {!pruefung.ok && <ul className="aus-field-error">{pruefung.gruende.map((g) => <li key={g}>{g}</li>)}</ul>}
          </>
        )}
        {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
        {info && <p className="aus-field-ok" role="status">{info}</p>}
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-secondary" disabled={busy} onClick={vorschau}>{gesperrt ? "PDF ansehen" : "PDF-Vorschau"}</button>
          {!gesperrt && <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={!pruefung.ok || busy} onClick={abschliessen}>{busy ? "…" : "Regiebericht abschließen"}</button>}
          {gesperrt && <button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={laden}>Herunterladen / Teilen</button>}
        </div>
      </section>

      {gesperrt && (
        <section className="aus-card">
          <h2 className="aus-h2">An Kunden senden</h2>
          <label className="aus-field"><span className="aus-label">E-Mail Kunde</span>
            <input className="aus-input" type="email" inputMode="email" value={an || d.kundeEmail} onChange={(e) => setAn(e.target.value)} /></label>
          <div className="aus-actions"><button type="button" className="aus-btn aus-btn-primary" disabled={busy} onClick={() => { if (!an) setAn(d.kundeEmail); void senden(); }}>Senden / Erneut senden</button></div>
          {eintrag.versand.length > 0 && <p className="aus-muted">Vorgemerkt: {eintrag.versand.map((v) => v.an).join(", ")}</p>}
        </section>
      )}

      {sig && <SignaturePad titel="Unterschrift Kunde (anerkannt)" rolle="Kunde" vorschlagName={d.unterschriftName || d.name || ""} onCancel={() => setSig(false)} onSave={unterschriftSpeichern} />}
    </div>
  );
}
