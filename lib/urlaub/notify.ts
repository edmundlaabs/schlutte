import type { Antrag } from "./types.ts";

/**
 * Benachrichtigungen zu Urlaubsanträgen — vorerst ohne Wirkung.
 * TODO: Mailversand hier einhängen: die zentrale Funktion `sendeMail` (Resend per fetch) liegt jetzt in
 * lib/mail/send.ts (Konfiguration über RESEND_API_KEY / MAIL_FROM, siehe docs/ABNAHME.md) und wird vom Modul Abnahme bereits genutzt. Aufrufer sind die Server Actions
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
