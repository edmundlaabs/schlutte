"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { updateEmployee } from "@/lib/data/employees";
import { parseAppKeys, type AppKey } from "@/lib/apps";

export type AccessUpdate = { id: string; apps: AppKey[] };

/**
 * Schreibt die vollständige App-Liste je Mitarbeiter (nicht nur den einen Haken),
 * damit schnelle Klicks hintereinander sich nicht gegenseitig überschreiben.
 * Admin-Rechte werden serverseitig geprüft; zusätzlich sperrt ein DB-Trigger.
 */
export async function setAccessAction(
  updates: AccessUpdate[]
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    for (const u of updates) {
      if (!u.id) continue;
      await updateEmployee(u.id, { app_access: parseAppKeys(u.apps) });
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/mitarbeiter");
  return {};
}
