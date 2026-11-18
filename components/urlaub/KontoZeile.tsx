"use client";

import { kontoSpeichernAction, uebertragBerechnenAction } from "@/app/(app)/urlaub/actions";
import { Meldung, useAktion } from "./useAktion";
import { tageText } from "@/lib/urlaub/datum";
import type { Konto } from "@/lib/urlaub/konto";

/** Eine Zeile der Kontentabelle: Anspruch/Übertrag/Korrektur bearbeitbar, übrige Werte berechnet. */
export function KontoZeile({
  employeeId,
  name,
  konto,
  notiz,
}: {
  employeeId: string;
  name: string;
  konto: Konto;
  notiz: string;
}) {
  const speichern = useAktion();
  const uebertrag = useAktion();
  const formId = `konto-${employeeId}`;
  const zahlFeld = (feld: string, wert: number, label: string) => (
    <input form={formId} name={feld} aria-label={`${label} ${name}`} className="aus-input is-amount" inputMode="decimal" defaultValue={String(wert).replace(".", ",")} />
  );
  return (
    <tr>
      <td>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            // Felder außerhalb des <form> (per form-Attribut verbunden) sind im FormData enthalten.
            speichern.ausfuehren(() => kontoSpeichernAction(fd));
          }}
        >
          <input type="hidden" name="employee_id" value={employeeId} />
          <input type="hidden" name="jahr" value={konto.jahr} />
        </form>
        <strong>{name}</strong>
        <Meldung result={speichern.result} />
        <Meldung result={uebertrag.result} />
      </td>
      <td>{zahlFeld("anspruch", konto.anspruch, "Anspruch")}</td>
      <td>
        {zahlFeld("uebertrag", konto.uebertrag, "Übertrag")}
        <input form={formId} type="date" name="uebertrag_verfall" aria-label={`Verfall Übertrag ${name}`} className="aus-input" defaultValue={konto.uebertragVerfall} style={{ marginTop: 6 }} />
      </td>
      <td>
        {zahlFeld("korrektur", konto.korrektur, "Korrektur")}
        <input form={formId} name="korrektur_notiz" aria-label={`Notiz Korrektur ${name}`} placeholder="Notiz" className="aus-input" defaultValue={notiz} style={{ marginTop: 6 }} />
      </td>
      <td>{tageText(konto.genommen)}</td>
      <td>{tageText(konto.geplant)}</td>
      <td>{tageText(konto.beantragt)}</td>
      <td className="is-rest">{tageText(konto.rest)}</td>
      <td>
        <div className="aus-stack">
          <button type="submit" form={formId} className="aus-btn aus-btn-secondary aus-btn-sm" disabled={speichern.pending}>Speichern</button>
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={uebertrag.pending}
            title={`Übertrag = Rest ${konto.jahr - 1} zum 31.12.`}
            onClick={() => uebertrag.ausfuehren(() => uebertragBerechnenAction(employeeId, konto.jahr))}>Übertrag aus Vorjahr</button>
        </div>
      </td>
    </tr>
  );
}
