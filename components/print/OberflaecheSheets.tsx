import { OberflaecheLabel } from "@/components/print/OberflaecheLabel";
import type { OberflaecheFormData } from "@/lib/types";

/** Verteilt `count` Labels auf Blätter à 2 (links, rechts). Letztes Blatt bei ungerader Zahl nur links. */
export function imposeLabels(count: number): Array<[boolean, boolean]> {
  const n = Math.max(1, Math.floor(count) || 1);
  const sheets: Array<[boolean, boolean]> = [];
  for (let i = 0; i < n; i += 2) sheets.push([true, i + 1 < n]);
  return sheets;
}

/**
 * Imposition: A4 quer (297 × 210 mm), je Blatt zwei A5-Labels nebeneinander, 100 %.
 * Ungerade Anzahl → letztes Blatt nur links belegt.
 * Schnittmarken (1 cm × 1 pt) oben und unten auf der Mittellinie bei 148,5 mm, 4 mm vom Rand versetzt.
 */
export function OberflaecheSheets({ data }: { data: OberflaecheFormData }) {
  const sheets = imposeLabels(data.labelCount);
  return (
    <>
      {sheets.map(([left, right], i) => (
        <article key={i} className="imposition-sheet" data-sheet={i + 1}>
          <span aria-hidden className="imposition-mark imposition-mark--top" />
          <span aria-hidden className="imposition-mark imposition-mark--bottom" />
          <div className="imposition-slot">{left && <OberflaecheLabel data={data} />}</div>
          <div className="imposition-slot">{right && <OberflaecheLabel data={data} />}</div>
        </article>
      ))}
    </>
  );
}
