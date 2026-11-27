import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";
import { abnahmeDateiname, regieDateiname } from "@/lib/abnahme/filename";

export const dynamic = "force-dynamic";

/** Download des abgelegten PDFs (PC, Ablage): ?typ=abnahme|regie&id=… */
export async function GET(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const u = new URL(request.url);
  const typ = u.searchParams.get("typ");
  const id = u.searchParams.get("id");
  if (!id || (typ !== "abnahme" && typ !== "regie")) return jsonFehler(400, "Ungültige Anfrage.");
  const supabase = await createClient();
  const { data: d } = await supabase.from(typ === "abnahme" ? "abnahme_protokolle" : "abnahme_regieberichte").select("*").eq("id", id).maybeSingle();
  const original = typ === "abnahme" && u.searchParams.get("art") === "original";
  // Früheres PDF (nach „PDF neu erzeugen“): ?art=historie&hid=<id> – nur Einträge dieses Protokolls.
  let historiePfad: string | null = null;
  if (typ === "abnahme" && u.searchParams.get("art") === "historie") {
    const h = await supabase.from("abnahme_pdf_historie").select("pdf_path").eq("id", u.searchParams.get("hid") ?? "").eq("protokoll_id", id).maybeSingle();
    historiePfad = h.data?.pdf_path ?? null;
    if (!historiePfad) return jsonFehler(404, "Kein PDF vorhanden.");
  }
  const pfad: string | null | undefined = historiePfad ?? (original ? d?.original_path : d?.pdf_path);
  if (!d || !pfad) return jsonFehler(404, "Kein PDF vorhanden.");
  const dl = await supabase.storage.from("abnahme").download(pfad);
  if (dl.error || !dl.data) return jsonFehler(404, "PDF konnte nicht gelesen werden.");
  const datum = String(typ === "abnahme" ? (d.abgeschlossen_at ?? d.created_at) : d.datum).slice(0, 10);
  const name = historiePfad
    ? `${abnahmeDateiname(d.kommission_nr, d.kunde, datum).replace(/\.pdf$/, "")}_frueher.pdf`
    : original
    ? `Positionsliste_${String(d.kommission_nr ?? "").trim() || "ohne-Kommission"}.pdf`
    : typ === "abnahme" ? abnahmeDateiname(d.kommission_nr, d.kunde, datum) : regieDateiname(d.kommission_nr, d.kunde, datum);
  return new Response(dl.data, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${u.searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}"` },
  });
}
