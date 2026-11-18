import { ueberschneiden } from "./datum.ts";
import { AKTIVE_STATUS, type Antrag, type Konfliktpaar, type Sperre } from "./types.ts";

export type KonfliktInfo = {
  /** Überschneidungen mit dem Partner eines Konfliktpaars. */
  paare: { partnerId: string; antragId: string }[];
  /** Urlaubssperren, in die der Antrag hineinfällt. */
  sperren: Sperre[];
};

export const KEIN_KONFLIKT: KonfliktInfo = { paare: [], sperren: [] };

export function hatKonflikt(k: KonfliktInfo): boolean {
  return k.paare.length > 0 || k.sperren.length > 0;
}

/**
 * Konflikte eines Antrags (nur Hinweis, blockiert nie): überschneidende aktive Anträge
 * eines Konfliktpartners sowie Urlaubssperren im Zeitraum.
 */
export function findeKonflikte(
  antrag: Pick<Antrag, "id" | "employee_id" | "von" | "bis">,
  alle: readonly Pick<Antrag, "id" | "employee_id" | "von" | "bis" | "status">[],
  paare: readonly Konfliktpaar[],
  sperren: readonly Sperre[],
): KonfliktInfo {
  const partner = new Set<string>();
  for (const p of paare) {
    if (p.employee_a === antrag.employee_id) partner.add(p.employee_b);
    if (p.employee_b === antrag.employee_id) partner.add(p.employee_a);
  }
  return {
    paare: alle
      .filter(
        (a) =>
          a.id !== antrag.id &&
          partner.has(a.employee_id) &&
          AKTIVE_STATUS.includes(a.status) &&
          ueberschneiden(a, antrag),
      )
      .map((a) => ({ partnerId: a.employee_id, antragId: a.id })),
    sperren: sperren.filter((s) => ueberschneiden(s, antrag)),
  };
}

/** Paar normalisieren (a < b), damit die Unique-Regel greift. */
export function sortiertesPaar(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}
