import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";

export const dynamic = "force-dynamic";

/** Dokumente, die für die Baustelle geladen werden können (noch nicht abgeschlossen). */
export async function GET() {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const supabase = await createClient();
  const [p, r] = await Promise.all([
    supabase
      .from("abnahme_protokolle")
      .select("id,kommission_nr,kunde,projekt,titel,status,version,checkout_device,checkout_at,mitarbeiter_name")
      .neq("status", "abgeschlossen")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("abnahme_regieberichte")
      .select("id,kommission_nr,kunde,datum,status,checkout_device,checkout_at,mitarbeiter_name")
      .neq("status", "abgeschlossen")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (p.error) return jsonFehler(500, p.error.message);
  return Response.json({
    ok: true,
    protokolle: p.data ?? [],
    regieberichte: r.error ? [] : (r.data ?? []),
  });
}
