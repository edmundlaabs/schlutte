/**
 * HTML-Layout der Abnahme-/Regie-Mails im Grabner-Design-Branding: Tabellen-Layout mit Inline-CSS (Apple Mail,
 * Outlook, Gmail), weiße Karte auf Papier-Hintergrund (bleibt im Dunkelmodus der Mailclients lesbar), PNG-Logo.
 */
export type MailLayoutInput = {
  sprache: "de" | "en";
  anrede: string;
  /** Absätze (reiner Text; wird escaped). */
  absaetze: string[];
  /** Button „Protokoll und Fotos online ansehen“ – nur wenn ein Link vorhanden ist. */
  link?: string | null;
  /** Basis-URL für das Logo (Standard: NEXT_PUBLIC_PUBLIC_BASE_URL). */
  basisUrl: string;
  /** Kontaktzeile hinter „Diese Adresse empfängt keine Antworten – Kontakt: “. */
  kontakt: string;
};

const INK = "#0E0E0D";
const MUTED = "#5C5852";
const BRASS = "#A6824A";
const PAPER = "#F6F2EA";
const FONT = "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const KONTAKT_STANDARD = { de: "Ihr Ansprechpartner bei Grabner Design", en: "your contact at Grabner Design" };

/** Kontaktzeile aus MAIL_CONTACT (z. B. „Name, Telefon, E-Mail“); ohne Angabe ein neutraler Standardtext. */
export function mailKontakt(sprache: "de" | "en"): string {
  const k = (process.env.MAIL_CONTACT ?? "").trim();
  return k || KONTAKT_STANDARD[sprache];
}

export function hinweisKeineAntwort(sprache: "de" | "en", kontakt: string): string {
  return sprache === "en"
    ? `This address does not receive replies – contact: ${kontakt}`
    : `Diese Adresse empfängt keine Antworten – Kontakt: ${kontakt}`;
}

export function baueMailHtml(i: MailLayoutInput): string {
  const en = i.sprache === "en";
  const basis = i.basisUrl.replace(/\/+$/, "");
  const absaetze = i.absaetze.map((a) => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};">${esc(a)}</p>`).join("");
  const button = i.link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px 0;"><tr><td style="background:${INK};border-radius:2px;">
<a href="${esc(i.link)}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;font-weight:500;color:#FBF9F4;text-decoration:none;">${en ? "View record and photos online" : "Protokoll und Fotos online ansehen"}</a>
</td></tr></table>
<p style="margin:0 0 20px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">${en ? "Or copy this link:" : "Oder diesen Link kopieren:"}<br><a href="${esc(i.link)}" style="color:${MUTED};word-break:break-all;">${esc(i.link)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="${i.sprache}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Grabner Design</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-top:3px solid ${BRASS};">
<tr><td style="padding:28px 32px 8px 32px;"><img src="${esc(basis)}/brand/grabner-logo-mail.png" width="140" alt="Grabner Design" style="display:block;border:0;height:auto;width:140px;"></td></tr>
<tr><td style="padding:16px 32px 8px 32px;">
<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};">${esc(i.anrede)}</p>
${absaetze}
${button}
</td></tr>
<tr><td style="padding:0 32px 8px 32px;"><p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};">${en ? "Kind regards" : "Mit freundlichen Grüßen"}<br><strong style="font-weight:500;">Grabner Design GmbH</strong><br>Tüchlinger Weg 1, 79400 Kandern</p></td></tr>
<tr><td style="padding:20px 32px 28px 32px;"><div style="border-top:1px solid #D9D2C5;padding-top:14px;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">${esc(hinweisKeineAntwort(i.sprache, i.kontakt))}</div></td></tr>
</table></td></tr></table></body></html>`;
}
