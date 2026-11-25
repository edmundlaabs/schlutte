"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aendereProtokollKopf, aendereRegieKopf, type ProtokollKopf, type RegieKopf } from "@/app/(app)/abnahme/actions";

type Feld = { key: string; label: string; typ?: "text" | "email" | "date" | "area" | "sprache" };

const FELDER_PROTOKOLL: Feld[] = [
  { key: "kunde", label: "Kunde *" }, { key: "projekt", label: "Projekt" }, { key: "titel", label: "Bezeichnung (z. B. Teilabnahme EG)" },
  { key: "ort", label: "Baustellenadresse / Ort" }, { key: "sprache", label: "Sprache", typ: "sprache" },
  { key: "kundeEmail", label: "Kunden-E-Mail", typ: "email" }, { key: "kopieEmail", label: "Kopie-E-Mail", typ: "email" },
  { key: "bemerkung", label: "Bemerkung", typ: "area" },
];
const FELDER_REGIE: Feld[] = [
  { key: "kunde", label: "Kunde *" }, { key: "name", label: "Auftraggeber" }, { key: "strasse", label: "Straße" }, { key: "ort", label: "Ort" },
  { key: "telefon", label: "Telefon" }, { key: "datum", label: "Datum", typ: "date" }, { key: "sprache", label: "Sprache", typ: "sprache" },
  { key: "kundeEmail", label: "Kunden-E-Mail", typ: "email" }, { key: "kopieEmail", label: "Kopie-E-Mail", typ: "email" },
  { key: "beschreibung", label: "Auftrag / Beschreibung", typ: "area" },
];

/** Kopfdaten eines nicht abgeschlossenen Protokolls bzw. Regieberichts online ändern. */
export function KopfBearbeiten({ typ, id, werte }: { typ: "abnahme" | "regie"; id: string; werte: Record<string, string> }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(werte);
  const [fehler, setFehler] = useState("");
  const [pending, start] = useTransition();
  const felder = typ === "regie" ? FELDER_REGIE : FELDER_PROTOKOLL;

  function speichern() {
    setFehler("");
    start(async () => {
      const r = typ === "regie" ? await aendereRegieKopf(id, form as unknown as RegieKopf) : await aendereProtokollKopf(id, form as unknown as ProtokollKopf);
      if (r.ok) {
        setOffen(false);
        router.refresh();
      } else setFehler(r.error);
    });
  }

  if (!offen) {
    return (
      <button type="button" className="aus-btn aus-btn-secondary" onClick={() => { setForm(werte); setOffen(true); }}>
        Kopfdaten ändern
      </button>
    );
  }
  return (
    <section className="aus-card">
      <h2 className="aus-h2">Kopfdaten ändern</h2>
      <div className="aus-grid abn-kopf">
        {felder.map((f) => (
          <label key={f.key} className={f.typ === "area" ? "aus-field aus-span-2" : "aus-field"}>
            <span className="aus-label">{f.label}</span>
            {f.typ === "area" ? (
              <textarea className="aus-textarea" rows={3} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ) : f.typ === "sprache" ? (
              <select className="aus-select" value={form[f.key] ?? "de"} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            ) : (
              <input className="aus-input" type={f.typ === "email" ? "email" : f.typ === "date" ? "date" : "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}
      <div className="aus-actions">
        <button type="button" className="aus-btn aus-btn-primary" disabled={pending} onClick={speichern}>{pending ? "Wird gespeichert …" : "Speichern"}</button>
        <button type="button" className="aus-btn aus-btn-quiet" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </section>
  );
}
