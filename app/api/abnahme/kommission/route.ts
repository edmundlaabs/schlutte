import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";

export const dynamic = "force-dynamic";

/** Vorbelegung für einen neuen Regiebericht: Kunde aus commissions, Adresse aus dem letzten Dokument derselben Kommission. */
export async function GET(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const nr = (new URL(request.url).searchParams.get("nr") ?? "").trim();
  if (!nr) return jsonFehler(400, "Kommissionsnummer fehlt.");
  const supabase = await createClient();
  const k = await supabase.from("commissions").select("id,commission_number,customer_name,project_name").eq("commission_number", nr).maybeSingle();
  const r = await supabase
    .from("abnahme_regieberichte")
    .select("name,strasse,ort,telefon,kunde_email")
    .eq("kommission_nr", nr)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const a = await supabase
    .from("abnahme_protokolle")
    .select("ort,kunde,kunde_email")
    .eq("kommission_nr", nr)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Response.json({
    ok: true,
    gefunden: Boolean(k.data),
    commissionId: k.data?.id ?? null,
    kunde: k.data?.customer_name ?? a.data?.kunde ?? "",
    name: r.data?.name ?? "",
    strasse: r.data?.strasse ?? "",
    ort: r.data?.ort ?? a.data?.ort ?? "",
    telefon: r.data?.telefon ?? "",
    kundeEmail: r.data?.kunde_email ?? a.data?.kunde_email ?? "",
  });
}
