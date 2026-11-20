/**
 * Zentraler Mailversand der Schlutte (Resend, per fetch – keine Library).
 * Konfiguration nur über Umgebungsvariablen:
 *   RESEND_API_KEY  – API-Key (nie im Code)
 *   MAIL_FROM       – Absender, z. B. "Grabner Design <abnahme@deine-domain.de>" (Domain bei Resend verifiziert)
 *   MAIL_COPY_TO    – optional: interne Kopie (BCC) für alle Abnahme-/Regie-Mails
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
export type MailResult = { ok: true; id: string } | { ok: false; error: string; nichtKonfiguriert?: boolean };

export function mailKonfiguriert(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export function interneKopie(): string[] {
  return (process.env.MAIL_COPY_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
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
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to.trim()],
        bcc: input.bcc?.filter(istEmail),
        subject: input.subject,
        text: input.text,
        attachments: input.attachments?.map((a) => ({ filename: a.filename, content: base64(a.content) })),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) return { ok: false, error: json.message ?? `Resend antwortete mit ${res.status}.` };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mailversand fehlgeschlagen." };
  }
}
