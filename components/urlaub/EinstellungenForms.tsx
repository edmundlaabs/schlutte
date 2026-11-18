"use client";

import {
  betriebsferienAnlegenAction,
  betriebsferienLoeschenAction,
  musterLoeschenAction,
  musterSpeichernAction,
  paarAnlegenAction,
  paarLoeschenAction,
  sperreAnlegenAction,
  sperreLoeschenAction,
} from "@/app/(app)/urlaub/actions";
import { AktionsForm, LoeschButton } from "./AktionsForm";
import { datumKurz, zeitraumText } from "@/lib/urlaub/datum";
import type { Betriebsferien, Konfliktpaar, Sperre } from "@/lib/urlaub/types";

type Person = { id: string; name: string };
const TAGE = [["mo", "Mo"], ["di", "Di"], ["mi", "Mi"], ["do", "Do"], ["fr", "Fr"], ["sa", "Sa"], ["so", "So"]] as const;

function PersonenSelect({ name, label, personen }: { name: string; label: string; personen: Person[] }) {
  return (
    <div className="aus-field">
      <label className="aus-label">{label}</label>
      <select name={name} className="aus-select" required defaultValue="">
        <option value="" disabled>Wählen …</option>
        {personen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

export function KonfliktpaareEinstellung({ paare, personen }: { paare: Konfliktpaar[]; personen: Person[] }) {
  const name = (id: string) => personen.find((p) => p.id === id)?.name ?? "Unbekannt";
  return (
    <div className="aus-stack">
      <p className="aus-help">Zwei Mitarbeiter, die nie gleichzeitig abwesend sein sollen (z. B. Nic und Noah). Nur Hinweis im Eingang und Teamkalender – es wird nie blockiert. Mitarbeiter sehen die Paare nicht.</p>
      {paare.length === 0 && <p className="aus-help">Noch keine Konfliktpaare.</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {paare.map((p) => (
          <li key={p.id} className="urlaub-zeile">
            <div className="urlaub-zeile-kopf">
              <span className="urlaub-zeile-titel">{name(p.employee_a)} ↔ {name(p.employee_b)}</span>
              <LoeschButton action={() => paarLoeschenAction(p.id)} text="Konfliktpaar löschen?" />
            </div>
          </li>
        ))}
      </ul>
      <AktionsForm action={paarAnlegenAction} label="Paar hinzufügen">
        <PersonenSelect name="a" label="Mitarbeiter A" personen={personen} />
        <PersonenSelect name="b" label="Mitarbeiter B" personen={personen} />
      </AktionsForm>
    </div>
  );
}

export function SperrenEinstellung({ sperren }: { sperren: Sperre[] }) {
  return (
    <div className="aus-stack">
      <p className="aus-help">Zeiträume, in denen kein Urlaub gewünscht ist (z. B. Messe). Mitarbeiter sehen beim Beantragen einen Hinweis; genehmigen kannst du trotzdem.</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {sperren.map((s) => (
          <li key={s.id} className="urlaub-zeile">
            <div className="urlaub-zeile-kopf">
              <span><span className="urlaub-zeile-titel">{s.titel}</span> <span className="urlaub-zeile-meta">{zeitraumText(s.von, s.bis)}</span></span>
              <LoeschButton action={() => sperreLoeschenAction(s.id)} text="Urlaubssperre löschen?" />
            </div>
          </li>
        ))}
      </ul>
      <AktionsForm action={sperreAnlegenAction} label="Sperre hinzufügen">
        <div className="aus-field"><label className="aus-label">Titel</label><input name="titel" className="aus-input" required maxLength={80} placeholder="z. B. Messe" /></div>
        <div className="aus-field"><label className="aus-label">Von</label><input name="von" type="date" className="aus-input" required /></div>
        <div className="aus-field"><label className="aus-label">Bis</label><input name="bis" type="date" className="aus-input" required /></div>
      </AktionsForm>
    </div>
  );
}

export function BetriebsferienEinstellung({ ferien }: { ferien: Betriebsferien[] }) {
  return (
    <div className="aus-stack">
      <p className="aus-help">Für alle sichtbar im Kalender. Mit dem Schalter werden die Arbeitstage automatisch vom Urlaubskonto jedes Mitarbeiters abgezogen – ohne Antrag.</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {ferien.map((f) => (
          <li key={f.id} className="urlaub-zeile">
            <div className="urlaub-zeile-kopf">
              <span>
                <span className="urlaub-zeile-titel">{f.titel}</span> <span className="urlaub-zeile-meta">{zeitraumText(f.von, f.bis)}</span>
                <div className="urlaub-zeile-meta">{f.zaehlt_als_urlaub ? "Mitarbeiter müssen dafür Urlaub nehmen (wird vom Konto abgezogen)" : "Zählt nicht als Urlaub"}</div>
              </span>
              <LoeschButton action={() => betriebsferienLoeschenAction(f.id)} text="Betriebsferien löschen? Abgezogene Tage werden den Konten wieder gutgeschrieben." />
            </div>
          </li>
        ))}
      </ul>
      <AktionsForm action={betriebsferienAnlegenAction} label="Betriebsferien hinzufügen">
        <div className="aus-field"><label className="aus-label">Titel</label><input name="titel" className="aus-input" required maxLength={80} placeholder="z. B. Sommerpause" /></div>
        <div className="aus-field"><label className="aus-label">Von</label><input name="von" type="date" className="aus-input" required /></div>
        <div className="aus-field"><label className="aus-label">Bis</label><input name="bis" type="date" className="aus-input" required /></div>
        <label className="aus-check"><input type="checkbox" name="zaehlt_als_urlaub" /> Mitarbeiter müssen dafür Urlaub nehmen</label>
      </AktionsForm>
    </div>
  );
}

export type MusterAnzeige = { id: string; employee_id: string; gueltig_ab: string; mo: boolean; di: boolean; mi: boolean; do: boolean; fr: boolean; sa: boolean; so: boolean };

export function ArbeitsmusterEinstellung({ muster, personen }: { muster: MusterAnzeige[]; personen: Person[] }) {
  return (
    <div className="aus-stack">
      <p className="aus-help">Ohne Eintrag gilt Mo–Fr. Ein neuer Eintrag gilt ab seinem Datum (z. B. bei Wechsel auf Teilzeit); frühere Anträge werden nicht umgerechnet.</p>
      {personen.map((p) => {
        const eigene = muster.filter((m) => m.employee_id === p.id).sort((a, b) => a.gueltig_ab.localeCompare(b.gueltig_ab));
        return (
          <div key={p.id} className="urlaub-zeile">
            <div className="urlaub-zeile-titel">{p.name}</div>
            <div className="urlaub-zeile-meta">
              {eigene.length === 0 ? "Standard Mo–Fr" : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {eigene.map((m) => (
                    <li key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      ab {datumKurz(m.gueltig_ab, true)}: {TAGE.filter(([k]) => m[k]).map(([, l]) => l).join(", ") || "kein Arbeitstag"}
                      <LoeschButton action={() => musterLoeschenAction(m.id)} text="Arbeitsmuster-Eintrag löschen?" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <AktionsForm action={musterSpeichernAction} label="Muster speichern" zuruecksetzen={false}>
              <input type="hidden" name="employee_id" value={p.id} />
              <div className="aus-field"><label className="aus-label">Gültig ab</label><input name="gueltig_ab" type="date" className="aus-input" required /></div>
              <div className="urlaub-tage">
                {TAGE.map(([k, l]) => (
                  <label key={k}><input type="checkbox" name={k} defaultChecked={k !== "sa" && k !== "so"} /> {l}</label>
                ))}
              </div>
            </AktionsForm>
          </div>
        );
      })}
    </div>
  );
}
