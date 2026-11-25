"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { legeProtokollAn } from "@/app/(app)/abnahme/actions";
import { KundeKommissionAuswahl } from "@/components/abnahme/KundeKommissionAuswahl";
import { StrukturEditor } from "@/components/abnahme/StrukturEditor";
import { leeresProtokoll } from "@/lib/abnahme/edit";
import { ladeEntwurf, loescheEntwurf, speichereEntwurf, type Entwurf } from "@/lib/abnahme/entwurf";
import { LEERE_AUSWAHL, wendeAuswahlAn, type KundeKommission } from "@/lib/abnahme/kommission";
import { ladeFuerBaustelle } from "@/lib/abnahme/offline/sync";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import type { ProtokollDoc, Vorlage } from "@/lib/abnahme/types";
import { validiereNeuesProtokoll } from "@/lib/abnahme/validate";
import { formatDatumZeit } from "@/lib/abnahme/i18n";

type Mitarbeiter = { id: string | null; name: string };

const frisch = (m: Mitarbeiter): ProtokollDoc => leeresProtokoll({ id: crypto.randomUUID(), mitarbeiterId: m.id, mitarbeiterName: m.name });

/** Abnahmeprotokoll von Hand anlegen: Kunde/Kommission, Räume, Positionen, Prüfpunkte. */
export function ProtokollEditor({
  vorlagen,
  mitarbeiter,
  nutzerKey,
}: {
  vorlagen: Vorlage[];
  mitarbeiter: Mitarbeiter;
  nutzerKey: string;
}) {
  const [doc, setDoc] = useState<ProtokollDoc>(() => frisch(mitarbeiter));
  const [kk, setKk] = useState<KundeKommission>(LEERE_AUSWAHL);
  const [ausVorlage] = useState(false);
  const [angebot, setAngebot] = useState<Entwurf | null>(null);
  const beruehrt = useRef(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState<{ id: string; text: string } | null>(null);
  const [offlineSpeichern, setOfflineSpeichern] = useState(true);
  const [offline, setOffline] = useState<"" | "laeuft" | "ok" | string>("");

  // Gespeicherten Entwurf anbieten (erst nach dem Laden im Browser lesbar).
  useEffect(() => {
    queueMicrotask(() => {
      const e = ladeEntwurf(nutzerKey);
      if (e) setAngebot(e);
    });
  }, [nutzerKey]);

  // Entwurf nach jeder Änderung zwischenspeichern (500 ms Pause), nicht während das Angebot offen ist.
  useEffect(() => {
    if (!beruehrt.current || angebot || fertig) return;
    const t = setTimeout(() => speichereEntwurf(nutzerKey, { doc, kk, ausVorlage }), 500);
    return () => clearTimeout(t);
  }, [doc, kk, ausVorlage, angebot, fertig, nutzerKey]);

  const aendereDoc = (f: (d: ProtokollDoc) => ProtokollDoc) => {
    beruehrt.current = true;
    setDoc(f);
  };
  const aendereKk = (v: KundeKommission) => {
    beruehrt.current = true;
    setKk(v);
  };

  function wiederherstellen() {
    if (!angebot) return;
    beruehrt.current = true;
    setDoc({ ...angebot.doc, mitarbeiterId: mitarbeiter.id, mitarbeiterName: mitarbeiter.name });
    setKk(angebot.kk);
    setAngebot(null);
  }
  function verwerfen(frage = true) {
    if (frage && !window.confirm("Eingaben verwerfen? Es wurde noch nichts angelegt.")) return;
    loescheEntwurf(nutzerKey);
    beruehrt.current = false;
    setAngebot(null);
    setDoc(frisch(mitarbeiter));
    setKk(LEERE_AUSWAHL);
    setFehler("");
    setFertig(null);
    setOffline("");
  }

  const probleme = validiereNeuesProtokoll(doc, kk);

  async function anlegen() {
    if (probleme.length || busy) return;
    setBusy(true);
    setFehler("");
    try {
      const res = await legeProtokollAn(wendeAuswahlAn(doc, kk), { kommission: kk.modus, quelle: ausVorlage ? "vorlage" : "manuell" });
      if (!res.ok) throw new Error(res.error);
      loescheEntwurf(nutzerKey);
      setFertig({ id: res.data.id, text: `${kk.modus === "ohne" ? "Ohne Kommission" : `Kommission ${kk.nr}`} · ${kk.kunde}` });
      if (offlineSpeichern) {
        setOffline("laeuft");
        await registriereAbnahmeSw();
        const l = await ladeFuerBaustelle("abnahme", res.data.id);
        setOffline(l.ok ? "ok" : l.error);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (fertig) {
    return (
      <div className="aus-card abn-done">
        <h2 className="aus-h2">Protokoll angelegt</h2>
        <p>{fertig.text}.</p>
        {offline === "laeuft" && <p className="aus-muted">Wird für die Baustelle auf diesem Gerät gespeichert …</p>}
        {offline === "ok" && <p className="aus-field-ok" role="status">Auf diesem Gerät offline gespeichert. Die Begehung funktioniert jetzt auch ohne Internet.</p>}
        {offline !== "" && offline !== "laeuft" && offline !== "ok" && (
          <p className="aus-field-error" role="alert">Nicht offline gespeichert: {offline} Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>
        )}
        {offline === "" && <p className="aus-muted">Auf dem Tablet unter „Begehung“ mit „Für Baustelle laden“ holen.</p>}
        <div className="aus-actions">
          <Link className="aus-btn aus-btn-primary" href={`/abnahme/begehung?id=${fertig.id}`}>Zur Begehung</Link>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme">Zur Ablage</Link>
          <button type="button" className="aus-btn aus-btn-quiet" onClick={() => verwerfen(false)}>Weiteres Protokoll anlegen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="abn-import">
      {angebot && (
        <div className="aus-note" role="status">
          <div className="aus-note-body">
            <p className="aus-note-title">Gespeicherter Entwurf gefunden</p>
            <p>
              Vom {formatDatumZeit(angebot.savedAt, "de")}: {angebot.kk.kunde || "ohne Kunde"}, {angebot.doc.raeume.length} Raum/Räume,{" "}
              {angebot.doc.positionen.length} Position(en).
            </p>
            <div className="aus-actions">
              <button type="button" className="aus-btn aus-btn-primary" onClick={wiederherstellen}>Wiederherstellen</button>
              <button type="button" className="aus-btn aus-btn-quiet" onClick={() => verwerfen(false)}>Verwerfen</button>
            </div>
          </div>
        </div>
      )}

      <section className="aus-card">
        <h2 className="aus-h2">1 · Kunde, Kommission und Kopf</h2>
        <KundeKommissionAuswahl value={kk} onChange={aendereKk} />
        <div className="aus-grid abn-kopf">
          <label className="aus-field">
            <span className="aus-label">Baustellenadresse / Ort</span>
            <input className="aus-input" value={doc.ort} onChange={(e) => aendereDoc((d) => ({ ...d, ort: e.target.value }))} />
          </label>
          <label className="aus-field">
            <span className="aus-label">Bezeichnung (z. B. Teilabnahme EG)</span>
            <input className="aus-input" value={doc.titel} onChange={(e) => aendereDoc((d) => ({ ...d, titel: e.target.value }))} />
          </label>
          <label className="aus-field">
            <span className="aus-label">Sprache des Protokolls</span>
            <select className="aus-select" value={doc.sprache} onChange={(e) => aendereDoc((d) => ({ ...d, sprache: e.target.value === "en" ? "en" : "de" }))}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="aus-field">
            <span className="aus-label">Kunden-E-Mail (optional, für automatischen Versand)</span>
            <input className="aus-input" type="email" inputMode="email" value={doc.kundeEmail} onChange={(e) => aendereDoc((d) => ({ ...d, kundeEmail: e.target.value }))} />
          </label>
          <div className="aus-field">
            <span className="aus-label">Durchführender Mitarbeiter</span>
            <div className="abn-readonly">{mitarbeiter.name || "–"}</div>
          </div>
        </div>
      </section>

      <StrukturEditor doc={doc} setDoc={aendereDoc} vorlagen={vorlagen} modus="manuell" />

      <section className="aus-card">
        <h2 className="aus-h2">3 · Anlegen</h2>
        {probleme.length > 0 && <ul className="aus-field-error">{probleme.map((p) => <li key={p}>{p}</li>)}</ul>}
        {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
        <label className="abn-inline">
          <input type="checkbox" checked={offlineSpeichern} onChange={(e) => setOfflineSpeichern(e.target.checked)} />
          Gleich auf diesem Gerät offline speichern (für die Baustelle)
        </label>
        <p className="aus-help">Das Protokoll ist dann auf diesem Gerät ausgecheckt. Für ein anderes Tablet bitte abwählen und dort „Für Baustelle laden“ nutzen.</p>
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" disabled={busy || probleme.length > 0} onClick={anlegen}>
            {busy ? "Wird angelegt …" : "Abnahmeprotokoll anlegen"}
          </button>
          <button type="button" className="aus-btn aus-btn-quiet" onClick={() => verwerfen()}>Verwerfen</button>
        </div>
      </section>
    </div>
  );
}
