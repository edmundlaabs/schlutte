"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gibGeraetFrei, legeNachtragAn, sendeAction } from "@/app/(app)/abnahme/actions";

type Mangel = { id: string; text: string; frist: string; wo: string };

/** Senden/Erneut senden, offene Mängel als erledigt markieren (Nachtrag), Gerät freigeben (CEO/Admin). */
export function DetailAktionen({
  typ = "abnahme", id, abgeschlossen, hatPdf, kundeEmail, kopieEmail, ausgecheckt, istAdmin, offeneMaengel,
}: {
  typ?: "abnahme" | "regie";
  id: string;
  abgeschlossen: boolean;
  hatPdf: boolean;
  kundeEmail: string;
  kopieEmail: string;
  ausgecheckt: boolean;
  istAdmin: boolean;
  offeneMaengel: Mangel[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [an, setAn] = useState(kundeEmail);
  const [kopie, setKopie] = useState(kopieEmail);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  function senden() {
    setMeldung(null);
    start(async () => {
      const r = await sendeAction(typ, id, an, kopie);
      setMeldung(r.ok ? { ok: true, text: "Gesendet." } : { ok: false, text: r.error });
      router.refresh();
    });
  }
  function nachtrag() {
    setMeldung(null);
    start(async () => {
      const r = await legeNachtragAn(id, Array.from(gewaehlt));
      if (r.ok) router.push(`/abnahme/protokoll/${r.data.id}`);
      else setMeldung({ ok: false, text: r.error });
    });
  }
  function freigeben() {
    if (!window.confirm("Gerät freigeben? Nicht synchronisierte Eingaben auf dem Tablet gehen dann nicht verloren, lassen sich aber erst nach erneutem Laden zusammenführen.")) return;
    start(async () => {
      const r = await gibGeraetFrei(typ, id);
      setMeldung(r.ok ? { ok: true, text: "Gerät freigegeben." } : { ok: false, text: r.error });
      router.refresh();
    });
  }

  return (
    <>
      {meldung && <p className={meldung.ok ? "aus-field-ok" : "aus-field-error"} role="status">{meldung.text}</p>}

      {abgeschlossen && hatPdf && (
        <div className="aus-card">
          <h2 className="aus-h2">An Kunden senden</h2>
          <div className="aus-grid abn-kopf">
            <label className="aus-field">
              <span className="aus-label">E-Mail Kunde</span>
              <input className="aus-input" type="email" value={an} onChange={(e) => setAn(e.target.value)} />
            </label>
            <label className="aus-field">
              <span className="aus-label">Zusätzliche Kopie (optional)</span>
              <input className="aus-input" type="email" value={kopie} onChange={(e) => setKopie(e.target.value)} />
            </label>
          </div>
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-primary" disabled={pending || !an.trim()} onClick={senden}>Senden / Erneut senden</button>
          </div>
        </div>
      )}

      {abgeschlossen && offeneMaengel.length > 0 && (
        <div className="aus-card">
          <h2 className="aus-h2">Offene Mängel ({offeneMaengel.length})</h2>
          <ul className="aus-list">
            {offeneMaengel.map((m) => (
              <li key={m.id} className="aus-item">
                <label className="abn-inline">
                  <input
                    type="checkbox"
                    checked={gewaehlt.has(m.id)}
                    onChange={() => setGewaehlt((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                  />
                  <span><strong>{m.wo}</strong><br />{m.text}{m.frist && <span className="aus-muted"> · Frist {m.frist}</span>}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="aus-help">Als erledigt markieren legt einen Nachtrag (neue Version) an. Die bisherige Version bleibt unverändert. Der Nachtrag wird auf dem Tablet geladen, unterschrieben und abgeschlossen.</p>
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-primary" disabled={pending || gewaehlt.size === 0} onClick={nachtrag}>
              Nachtrag anlegen ({gewaehlt.size} erledigt)
            </button>
          </div>
        </div>
      )}

      {ausgecheckt && istAdmin && (
        <div className="aus-card">
          <h2 className="aus-h2">Gerät</h2>
          <p className="aus-muted">Das Protokoll ist auf einem Tablet ausgecheckt. Nur wenn das Gerät nicht mehr verfügbar ist, freigeben.</p>
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-secondary" disabled={pending} onClick={freigeben}>Gerät freigeben</button>
          </div>
        </div>
      )}
    </>
  );
}
