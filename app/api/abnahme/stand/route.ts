import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";

export const dynamic = "force-dynamic";

/** Archivierten Stand eines Protokolls als JSON herunterladen: ?id=<stand-id> */
export async function GET(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonFehler(400, "Ungültige Anfrage.");
  const supabase = await createClient();
  const { data } = await supabase.from("abnahme_staende").select("art,rev,created_at,protokoll_id,doc").eq("id", id).maybeSingle();
  if (!data) return jsonFehler(404, "Stand nicht gefunden.");
  const name = `Abnahme-Stand_${data.art}_rev${data.rev}_${String(data.created_at).slice(0, 10)}.json`;
  return new Response(JSON.stringify(data.doc, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
