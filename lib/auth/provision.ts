import type { SupabaseClient, User } from "@supabase/supabase-js";

// "edmund.laabs" / "edmund_laabs" -> "Edmund Laabs"
export function humanizeName(raw: string): string {
  return raw
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

// Nur der Vorname für die Begrüßung: "Edmund Laabs" / "Edmund.laabs" -> "Edmund"
export function firstNameOf(raw: string): string {
  const first = raw.split(/[._\-\s]+/).filter(Boolean)[0] ?? raw;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Self-Provisioning: legt den Mitarbeiter-Eintrag zur Anmeldung an, falls noch keiner existiert.
 * Fehler (z. B. RLS) werden bewusst verschluckt — dann bleibt es beim Zustand ohne Datensatz.
 */
export async function provisionEmployee(supabase: SupabaseClient, user: User): Promise<void> {
  if (!user.email) return;
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .ilike("email", user.email)
    .maybeSingle();
  if (existing) return;

  const local = user.email.split("@")[0];
  const metaName =
    typeof user.user_metadata?.full_name === "string" ? (user.user_metadata.full_name as string) : "";
  const initials = local.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "USR";
  await supabase.from("employees").insert({
    id: user.id,
    email: user.email,
    name: metaName || humanizeName(local),
    initials,
    is_admin: false,
    is_active: true,
  });
}
