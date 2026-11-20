import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/roles";
import { jsonFehler } from "@/lib/abnahme/server-auth";

/** Platzhalter bis Schritt 7 (Regiebericht). */
export async function syncRegie(_supabase: SupabaseClient, _ctx: UserContext, _body: unknown): Promise<Response> {
  void _supabase; void _ctx; void _body;
  return jsonFehler(501, "Regiebericht-Sync folgt.");
}
