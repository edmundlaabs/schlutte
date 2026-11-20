import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";

export const dynamic = "force-dynamic";

/** Gibt den Checkout frei (nach Sync oder durch CEO/Admin mit force). */
export async function POST(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const body = (await request.json().catch(() => null)) as { typ?: string; id?: string; deviceId?: string; force?: boolean } | null;
  if (!body?.id || !body.deviceId || (body.typ !== "abnahme" && body.typ !== "regie")) return jsonFehler(400, "Ungültige Anfrage.");
  const supabase = await createClient();
  const r = await supabase.rpc("abnahme_release", { p_typ: body.typ, p_id: body.id, p_device: body.deviceId, p_force: Boolean(body.force) });
  if (r.error) return jsonFehler(403, r.error.message);
  return Response.json({ ok: true });
}
