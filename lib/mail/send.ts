/**
 * Zentraler Mailversand der Schlutte (Resend, per fetch – keine Library).
 * Konfiguration nur über Umgebungsvariablen:
 *   RESEND_API_KEY  – API-Key (nie im Code)
 *   MAIL_FROM       – Absender, z. B. "Grabner Design <abnahme@deine-domain.de>" (Domain bei Resend verifiziert)
 *   MAIL_COPY_TO    – optional: interne Kopie (BCC) für alle Abnahme-/Regie-Mails
 *   MAIL_REDIRECT_TO – Testschutz: gesetzt = ALLE Mails gehen nur an diese Adresse (kein BCC),
 *                      Betreff mit „[TEST → ursprünglicher Empfänger]“. Zum Livegang löschen.
 * Ohne Konfiguration wird nichts verschickt; das Ergebnis sagt es ausdrücklich (kein stilles Verschlucken).
 */

export type MailAnhang = { filename: string; content: Uint8Array };
export type MailInput = {
  to: string;
  bcc?: string[];
  subject: string;
  text: string;
  attachments?: MailAnhang[];
};
export type MailResult = { ok: true; id: string; umgeleitetAn?: string } | { ok: false; error: string; nichtKonfiguriert?: boolean };

export function mailKonfiguriert(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function interneKopie(): string[] {
  return (process.env.MAIL_COPY_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Umleitungsadresse (Testschutz) oder null. */
export function mailUmleitung(): string | null {
  const r = (process.env.MAIL_REDIRECT_TO ?? "").trim();
  return r || null;
}

/** Reine Logik der Umleitung (testbar): Empfänger, BCC und Betreff, wie sie an Resend gehen. */
export function wendeUmleitungAn(
  input: { to: string; bcc?: string[]; subject: string },
  umleitung: string | null
): { to: string; bcc: string[] | undefined; subject: string; umgeleitetAn?: string } {
  const to = input.to.trim();
  if (!umleitung) return { to, bcc: input.bcc?.filter(istEmail), subject: input.subject };
  return { to: umleitung, bcc: undefined, subject: `[TEST → ${to}] ${input.subject}`, umgeleitetAn: umleitung };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const istEmail = (s: string) => EMAIL.test(s.trim());

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export async function sendeMail(input: MailInput): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    return { ok: false, error: "Mailversand ist nicht konfiguriert (RESEND_API_KEY / MAIL_FROM fehlen).", nichtKonfiguriert: true };
  }
  if (!istEmail(input.to)) return { ok: false, error: "Ungültige Empfängeradresse." };
  const umleitung = mailUmleitung();
  if (umleitung && !istEmail(umleitung)) return { ok: false, error: "MAIL_REDIRECT_TO ist keine gültige Adresse; es wird nichts gesendet." };
  const ziel = wendeUmleitungAn(input, umleitung);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [ziel.to],
        bcc: ziel.bcc,
        subject: ziel.subject,
        text: input.text,
        attachments: input.attachments?.map((a) => ({ filename: a.filename, content: base64(a.content) })),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) return { ok: false, error: json.message ?? `Resend antwortete mit ${res.status}.` };
    return { ok: true, id: json.id, umgeleitetAn: ziel.umgeleitetAn };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mailversand fehlgeschlagen." };
  }
}
