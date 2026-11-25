"use client";

import { useRef, useState } from "react";
import { findeKommissionAction, sucheKommissionenAction } from "@/app/(app)/abnahme/actions";
import { KOMMISSION_FORMAT, type KommissionModus, type KundeKommission } from "@/lib/abnahme/kommission";
import type { KommissionTreffer } from "@/lib/data/abnahme";

const MODI: { modus: KommissionModus; label: string }[] = [
  { modus: "bestehend", label: "Bestehende suchen" },
  { modus: "neu", label: "Neu anlegen" },
  { modus: "ohne", label: "Ohne Kommission" },
];

/**
 * Kunde und Kommission wählen – gemeinsam für Import, manuellen Editor und nachträgliche Zuordnung.
 * Es wird nichts gespeichert: eine neue Kommission legt erst das Speichern des Protokolls an.
 */
export function KundeKommissionAuswahl({
  value,
  onChange,
  hinweisKunde,
  suchvorschlag,
  modi = ["bestehend", "neu", "ohne"],
  mitKunde = true,
}: {
  value: KundeKommission;
  onChange: (v: KundeKommission) => void;
  /** Hilfetext unter dem Kundenfeld (z. B. Profacto schneidet Namen ab). */
  hinweisKunde?: string;
  /** Vorbelegung der Suche (z. B. Nummer aus der Profacto-PDF). */
  suchvorschlag?: string;
  /** Angebotene Wege (Zuordnung zu einem bestehenden Protokoll: ohne „ohne“). */
  modi?: KommissionModus[];
  /** false: Kunde und Projekt nicht anzeigen (bleiben am Protokoll unverändert). */
  mitKunde?: boolean;
}) {
  const [q, setQ] = useState(suchvorschlag ?? "");
  const [treffer, setTreffer] = useState<KommissionTreffer[]>([]);
  const [suche, setSuche] = useState<"" | "laeuft" | "fertig">("");
  const [dupli, setDupli] = useState<KommissionTreffer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lauf = useRef(0);

  function setze(patch: Partial<KundeKommission>) {
    onChange({ ...value, ...patch });
  }

  function modusWechsel(modus: KommissionModus) {
    setDupli(null);
    if (modus === value.modus) return;
    onChange({ ...value, modus, commissionId: null, nr: "" });
  }

  function suchen(text: string) {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    const clean = text.trim();
    if (clean.length < 2) {
      lauf.current++;
      setTreffer([]);
      setSuche("");
      return;
    }
    setSuche("laeuft");
    timer.current = setTimeout(async () => {
      const nr = ++lauf.current;
      const liste = await sucheKommissionenAction(clean);
      if (nr !== lauf.current) return; // veraltete Antwort
      setTreffer(liste);
      setSuche("fertig");
    }, 250);
  }

  function waehle(t: KommissionTreffer) {
    setTreffer([]);
    setSuche("");
    setQ("");
    onChange({ modus: "bestehend", commissionId: t.id, nr: t.nr, kunde: t.kunde, projekt: t.projekt });
  }

  async function pruefeNeueNummer(nr: string) {
    const clean = nr.trim();
    setDupli(null);
    if (!KOMMISSION_FORMAT.test(clean)) return;
    const t = await findeKommissionAction(clean);
    if (t) setDupli(t);
  }

  const nrFehler = value.modus === "neu" && value.nr.trim() !== "" && !KOMMISSION_FORMAT.test(value.nr.trim());

  return (
    <div className="abn-kk">
      <div className="abn-seg" role="radiogroup" aria-label="Kommission">
        {MODI.filter((m) => modi.includes(m.modus)).map((m) => (
          <button
            key={m.modus}
            type="button"
            role="radio"
            aria-checked={value.modus === m.modus}
            className={value.modus === m.modus ? "abn-seg-btn is-on" : "abn-seg-btn"}
            onClick={() => modusWechsel(m.modus)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.modus === "bestehend" && (
        <div className="aus-field">
          {value.commissionId ? (
            <div className="abn-kk-gewaehlt">
              <span>
                <span className="aus-mono">{value.nr}</span> · {value.kunde}
                {value.projekt && <span className="aus-muted"> · {value.projekt}</span>}
              </span>
              <button
                type="button"
                className="aus-btn aus-btn-quiet aus-btn-sm"
                onClick={() => onChange({ ...value, commissionId: null, nr: "" })}
              >
                Ändern
              </button>
            </div>
          ) : (
            <>
              <label className="aus-label" htmlFor="kk-suche">
                Kommissionsnummer oder Kunde suchen <span className="aus-req">*</span>
              </label>
              <input
                id="kk-suche"
                className="aus-input"
                autoComplete="off"
                placeholder="z. B. 260081 oder Raemy"
                value={q}
                onChange={(e) => suchen(e.target.value)}
              />
              {suche === "laeuft" && <span className="aus-help">Suche läuft …</span>}
              {suche === "fertig" && treffer.length === 0 && (
                <span className="aus-help">
                  Keine Kommission gefunden. Mit „Neu anlegen“ eine neue Kommission erfassen oder „Ohne Kommission“ wählen.
                </span>
              )}
              {treffer.length > 0 && (
                <ul className="abn-kk-treffer" role="listbox" aria-label="Treffer">
                  {treffer.map((t) => (
                    <li key={t.id}>
                      <button type="button" role="option" aria-selected={false} className="abn-kk-treffer-btn" onClick={() => waehle(t)}>
                        <span className="aus-mono">{t.nr}</span> · {t.kunde}
                        {t.projekt && <span className="aus-muted"> · {t.projekt}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {value.modus === "neu" && (
        <div className="aus-field">
          <label className="aus-label" htmlFor="kk-nr">
            Neue Kommissionsnummer <span className="aus-req">*</span>
          </label>
          <input
            id="kk-nr"
            className="aus-input"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 Ziffern"
            value={value.nr}
            onChange={(e) => {
              setDupli(null);
              setze({ nr: e.target.value.replace(/\D/g, "") });
            }}
            onBlur={(e) => pruefeNeueNummer(e.target.value)}
          />
          {nrFehler && <span className="aus-field-error">Die Kommissionsnummer muss genau 6 Ziffern haben.</span>}
          {dupli && (
            <span className="aus-field-error">
              Kommission {dupli.nr} gibt es schon ({dupli.kunde}).{" "}
              <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => waehle(dupli)}>
                Diese verwenden
              </button>
            </span>
          )}
          <span className="aus-help">Die Kommission wird erst angelegt, wenn das Protokoll gespeichert wird.</span>
        </div>
      )}

      {value.modus === "ohne" && (
        <p className="aus-help">
          Kleinauftrag ohne Kommissionsnummer: Es wird keine Kommission angelegt, nur der Kundenname ist Pflicht.
          Eine Kommission lässt sich später noch zuordnen, solange das Protokoll nicht abgeschlossen ist.
        </p>
      )}

      {mitKunde && <div className="aus-grid abn-kopf">
        <label className="aus-field">
          <span className="aus-label">Kunde <span className="aus-req">*</span></span>
          <input className="aus-input" value={value.kunde} onChange={(e) => setze({ kunde: e.target.value })} />
          {hinweisKunde && <span className="aus-help">{hinweisKunde}</span>}
        </label>
        <label className="aus-field">
          <span className="aus-label">Projekt{value.modus === "ohne" ? " (optional)" : ""}</span>
          <input className="aus-input" value={value.projekt} onChange={(e) => setze({ projekt: e.target.value })} />
        </label>
      </div>}
    </div>
  );
}
