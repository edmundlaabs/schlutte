"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/roles";
import { APP_VERSION } from "@/lib/version";

/**
 * Markiert die aktuelle App-Version als gesehen. Immer APP_VERSION (nie ein Wert vom Client);
 * die Postgres-Funktion mark_release_seen ändert nur die eigene Zeile und nur diese Spalte.
 */
export async function markReleaseSeenAction(): Promise<{ ok: boolean }> {
  try {
    await requireUser();
    const db = await createClient();
    const { error } = await db.rpc("mark_release_seen", { version: APP_VERSION });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("Release-Hinweis konnte nicht gespeichert werden:", error);
    return { ok: false };
  }
}
