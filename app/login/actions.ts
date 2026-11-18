"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Name oder Passwort stimmt nicht.";

/**
 * Anmeldung per Mitarbeiter-ID + Passwort. Die Login-E-Mail wird serverseitig
 * nachgeschlagen und nie an den Browser gegeben. Setzt das Auth-Cookie.
 */
export async function loginWithEmployee(
  employeeId: string,
  password: string
): Promise<{ error?: string }> {
  if (!employeeId || !password) return { error: GENERIC_ERROR };
  try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("employees")
      .select("email, is_active, pending_approval")
      .eq("id", employeeId)
      .maybeSingle();
    if (emp?.pending_approval) {
      return { error: "Dein Konto wartet noch auf Freigabe durch CEO oder Administrator." };
    }
    if (!emp?.email || emp.is_active === false) return { error: GENERIC_ERROR };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emp.email as string,
      password,
    });
    if (error) {
      return {
        error: error.message === "Invalid login credentials" ? GENERIC_ERROR : `Fehler: ${error.message}`,
      };
    }
    return {};
  } catch {
    return { error: "Ein unerwarteter Fehler ist aufgetreten." };
  }
}
