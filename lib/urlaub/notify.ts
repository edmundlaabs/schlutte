import type { Antrag } from "./types.ts";

/**
 * Benachrichtigungen zu Urlaubsanträgen — vorerst ohne Wirkung.
 * TODO: Mailversand (Resend) hier an EINER Stelle einhängen. Aufrufer sind die Server Actions
 * in app/(app)/urlaub/actions.ts; sie rufen notify() nach jeder erfolgreichen Statusänderung.
 */
export type UrlaubEreignis =
  | "beantragt"
  | "genehmigt"
  | "abgelehnt"
  | "zurueckgezogen"
  | "storno_beantragt"
  | "storniert"
  | "storno_abgelehnt";

export async function notify(ereignis: UrlaubEreignis, antrag: Pick<Antrag, "id" | "employee_id" | "von" | "bis">): Promise<void> {
  void ereignis;
  void antrag;
  // TODO: Resend – an Admin/CEO (beantragt, storno_beantragt) bzw. den Mitarbeiter (Entscheidungen).
}
