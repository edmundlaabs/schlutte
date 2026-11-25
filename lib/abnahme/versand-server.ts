import { createClient } from "@/lib/supabase/server";
import { interneKopie, istEmail, mailKonfiguriert, sendeMail } from "@/lib/mail/send";
import { abnahmeDateiname, regieDateiname } from "@/lib/abnahme/filename";
import { formatDatum } from "@/lib/abnahme/i18n";

export type VersandErgebnis = { ok: true; schonGesendet?: boolean } | { ok: false; error: string; nichtKonfiguriert?: boolean };

/**
 * Verschickt das abgelegte PDF eines Dokuments per Mail und protokolliert den Versand
 * (wer, wann, an wen, Ergebnis). Mit `schluessel` idempotent (automatischer Versand nach dem Sync).
 */
export async function versendeDokument(args: {
  typ: "abnahme" | "regie";
  id: string;
  an: string;
  kopie?: string;
  schluessel?: string;
  ausgeloestVon: string | null;
}): Promise<VersandErgebnis> {
  const supabase = await createClient();
  const an = args.an.trim();
  if (!istEmail(an)) return { ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben." };
  const kopie = (args.kopie ?? "").trim();
  if (kopie && !istEmail(kopie)) return { ok: false, error: "Die Kopie-Adresse ist ungültig." };

  const tabelle = args.typ === "abnahme" ? "abnahme_protokolle" : "abnahme_regieberichte";
  const { data: d, error } = await supabase.from(tabelle).select("*").eq("id", args.id).maybeSingle();
  if (error || !d) return { ok: false, error: "Dokument nicht gefunden." };
  if (!d.pdf_path) return { ok: false, error: "Das PDF ist noch nicht synchronisiert." };

  if (args.schluessel) {
    const vorhanden = await supabase.from("abnahme_versand").select("id,status").eq("schluessel", args.schluessel).maybeSingle();
    if (vorhanden.data?.status === "gesendet") return { ok: true, schonGesendet: true };
  }

  const bcc = Array.from(new Set([...(kopie ? [kopie] : []), ...interneKopie()]));
  // Versandprotokoll: zuerst „vorgemerkt“, dann Ergebnis eintragen.
  let versandId: string | null = null;
  if (args.schluessel) {
    const ex = await supabase.from("abnahme_versand").select("id").eq("schluessel", args.schluessel).maybeSingle();
    versandId = ex.data?.id ?? null;
  }
  if (!versandId) {
    const ins = await supabase
      .from("abnahme_versand")
      .insert({ dokument_typ: args.typ, dokument_id: args.id, an, kopie: bcc.join(", ") || null, status: "vorgemerkt", schluessel: args.schluessel ?? null, ausgeloest_von: args.ausgeloestVon })
      .select("id")
      .single();
    if (ins.error) return { ok: false, error: `Versandprotokoll: ${ins.error.message}` };
    versandId = ins.data.id;
  }
  const abschluss = async (status: "gesendet" | "fehler", fehler?: string) => {
    await supabase
      .from("abnahme_versand")
      .update({ status, fehler: fehler ?? null, gesendet_at: status === "gesendet" ? new Date().toISOString() : null })
      .eq("id", versandId!);
  };

  if (!mailKonfiguriert()) {
    const msg = "Mailversand ist nicht konfiguriert (RESEND_API_KEY / MAIL_FROM).";
    await abschluss("fehler", msg);
    return { ok: false, error: msg, nichtKonfiguriert: true };
  }

  const dl = await supabase.storage.from("abnahme").download(d.pdf_path);
  if (dl.error || !dl.data) {
    await abschluss("fehler", "PDF konnte nicht gelesen werden.");
    return { ok: false, error: "PDF konnte nicht gelesen werden." };
  }
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const sprache = d.sprache === "en" ? "en" : "de";
  const datum = args.typ === "abnahme" ? (d.abgeschlossen_at ?? d.created_at) : d.datum;
  const dateiname = args.typ === "abnahme" ? abnahmeDateiname(d.kommission_nr, d.kunde, String(datum).slice(0, 10)) : regieDateiname(d.kommission_nr, d.kunde, String(datum).slice(0, 10));
  const art = args.typ === "abnahme" ? (sprache === "en" ? "Acceptance record" : "Abnahmeprotokoll") : (sprache === "en" ? "Time sheet" : "Regiebericht");
  const nr = String(d.kommission_nr ?? "").trim(); // leer = Protokoll ohne Kommission
  const subject = nr
    ? `${art} – ${sprache === "en" ? "Commission" : "Kommission"} ${nr} – ${d.kunde}`
    : `${art} – ${d.kunde}`;
  const bezug = (en: boolean) =>
    nr ? `${en ? " for commission " : " zur Kommission "}${nr}${d.projekt ? ` (${d.projekt})` : ""}` : d.projekt ? `${en ? " for " : " zum Projekt "}${d.projekt}` : "";
  const text =
    sprache === "en"
      ? `Dear ${d.kunde},\n\nplease find attached the ${art.toLowerCase()}${bezug(true)} dated ${formatDatum(String(datum), "en")}.\n\nKind regards\nGrabner Design GmbH\nTüchlinger Weg 1, 79400 Kandern`
      : `Guten Tag,\n\nanbei erhalten Sie das Dokument „${art}“${bezug(false)} vom ${formatDatum(String(datum), "de")}.\n\nMit freundlichen Grüßen\nGrabner Design GmbH\nTüchlinger Weg 1, 79400 Kandern`;

  const res = await sendeMail({ to: an, bcc, subject, text, attachments: [{ filename: dateiname, content: bytes }] });
  if (!res.ok) {
    await abschluss("fehler", res.error);
    return { ok: false, error: res.error };
  }
  await abschluss("gesendet");
  return { ok: true };
}
