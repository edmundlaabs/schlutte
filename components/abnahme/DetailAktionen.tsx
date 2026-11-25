"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { legeNachtragAn, loescheProtokollAction, loescheRegieAction, sendeAction } from "@/app/(app)/abnahme/actions";

type Mangel = { id: string; text: string; frist: string; wo: string };

/** Senden/Erneut senden, offene Mängel als erledigt markieren (Nachtrag), Protokoll bzw. Regiebericht löschen. */
export function DetailAktionen({
  typ = "abnahme", id, abgeschlossen, hatPdf, kundeEmail, kopieEmail, istAdmin, offeneMaengel, nachtraege = 0,
}: {
  nachtraege?: number;
  typ?: "abnahme" | "regie";
  id: string;
  abgeschlossen: boolean;
  hatPdf: boolean;
  kundeEmail: string;
  kopieEmail: string;
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
  function loeschen() {
    const regie = typ === "regie";
    const folge = nachtraege > 0 ? ` Dazu gehören ${nachtraege} Nachtrag${nachtraege === 1 ? "" : "e"}, die ebenfalls gelöscht werden.` : "";
    const sicher = abgeschlossen
      ? `Diesen ABGESCHLOSSENEN (unterschriebenen) ${regie ? "Regiebericht" : "Protokoll"} endgültig löschen?`
      : `Diesen ${regie ? "Regiebericht" : "Protokoll"} endgültig löschen?`;
    const inhalt = regie
      ? "Gelöscht werden die Arbeitszeilen, die Kundenunterschrift, das erzeugte PDF, das Versandprotokoll und archivierte Stände."
      : "Gelöscht werden Räume, Positionen, Mängel, Fotos, Unterschriften, das Original-PDF, das erzeugte PDF und das Versandprotokoll.";
    if (!window.confirm(`${sicher}${folge}\n\n${inhalt} Das lässt sich nicht rückgängig machen.`)) return;
    setMeldung(null);
    start(async () => {
      const r = regie ? await loescheRegieAction(id) : await loescheProtokollAction(id);
      if (r.ok) router.push("/abnahme");
      else setMeldung({ ok: false, text: r.error });
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

      {(!abgeschlossen || istAdmin) && (
        <div className="aus-card">
          <h2 className="aus-h2">{typ === "regie" ? "Regiebericht löschen" : "Protokoll löschen"}</h2>
          <p className="aus-muted">
            {abgeschlossen
              ? `Abgeschlossene ${typ === "regie" ? "Regieberichte" : "Protokolle"} dürfen nur CEO und Administratoren löschen.`
              : typ === "regie" ? "Zum Beispiel bei einem falsch angelegten Bericht, inklusive aller bisher erfassten Daten." : "Zum Beispiel bei einem falschen Import. Inklusive Original-PDF und aller bisher erfassten Daten."}
            {" Auf Tablets erscheint beim nächsten Sync „gelöscht“, die lokale Kopie lässt sich dann verwerfen."}
          </p>
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-danger" disabled={pending} onClick={loeschen}>{typ === "regie" ? "Regiebericht löschen" : "Protokoll löschen"}</button>
          </div>
        </div>
      )}
    </>
  );
}
