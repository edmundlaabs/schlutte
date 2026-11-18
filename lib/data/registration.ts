import { createAdminClient } from "@/lib/supabase/admin";

/** IDs der Mitarbeiter, die sich selbst registriert haben und auf Freigabe warten. */
export async function getPendingEmployeeIds(): Promise<Set<string>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("employees").select("id").eq("pending_approval", true);
    return new Set((data ?? []).map((r) => String(r.id)));
  } catch {
    return new Set();
  }
}
