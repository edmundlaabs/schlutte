"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail, MIN_PASSWORD_LENGTH } from "@/lib/data/auth-admin";
import { syntheticLoginEmail } from "@/lib/auth/login-email";

export type RegisterState = { error?: string; done?: boolean } | null;

const BAN = "876000h";

/**
 * Selbstregistrierung: legt Login + Mitarbeiter an, gesperrt bis CEO/Admin freigeben.
 * Passt der Name zu einem vorangelegten Mitarbeiter ohne Login, wird dieser übernommen.
 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  // Honeypot gegen simple Bots
  if (((formData.get("website") as string) ?? "") !== "") return { done: true };

  const name = ((formData.get("name") as string) ?? "").trim().replace(/\s+/g, " ");
  const initials = (((formData.get("initials") as string) ?? "").toUpperCase()).replace(/\s/g, "");
  const emailRaw = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const password2 = (formData.get("password2") as string) ?? "";

  if (name.length < 2 || name.length > 80) return { error: "Bitte einen Namen eingeben." };
  if (!/^[A-ZÄÖÜ]{1,3}$/.test(initials)) {
    return { error: "Das Kürzel muss aus 1–3 Buchstaben bestehen." };
  }
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { error: "Die E-Mail-Adresse sieht ungültig aus." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` };
  }
  if (password !== password2) return { error: "Die Passwörter stimmen nicht überein." };

  try {
    const admin = createAdminClient();

    // Vorangelegter Mitarbeiter mit diesem Namen, der noch keinen Login hat → übernehmen.
    const { data: sameName } = await admin
      .from("employees")
      .select("id, initials, email")
      .ilike("name", name.replace(/[%_]/g, "\\$&"));
    const loginless = (sameName ?? []).find((e) => !e.email);
    if ((sameName ?? []).length > 0 && !loginless) {
      return { error: "Dieser Name ist schon registriert. Bitte melde dich direkt an." };
    }

    if (!loginless) {
      const { data: dupInitials } = await admin
        .from("employees")
        .select("id")
        .eq("initials", initials)
        .maybeSingle();
      if (dupInitials) return { error: `Das Kürzel ${initials} ist schon vergeben.` };
    }

    const finalInitials = loginless ? String(loginless.initials) : initials;
    const loginEmail = emailRaw || syntheticLoginEmail(finalInitials);
    if (await findAuthUserIdByEmail(loginEmail)) {
      return { error: "Diese E-Mail-Adresse ist schon registriert." };
    }
    if (emailRaw) {
      const { data: dupMail } = await admin.from("employees").select("id").ilike("email", emailRaw).maybeSingle();
      if (dupMail) return { error: "Diese E-Mail-Adresse ist schon registriert." };
    }

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      ban_duration: BAN,
      user_metadata: { full_name: name },
    });
    if (authErr || !created.user) {
      return { error: "Registrierung fehlgeschlagen. Bitte später erneut versuchen." };
    }

    const write = loginless
      ? admin
          .from("employees")
          .update({ email: loginEmail, pending_approval: true })
          .eq("id", loginless.id)
      : admin.from("employees").insert({
          id: created.user.id,
          initials: finalInitials,
          name,
          email: loginEmail,
          role: "mitarbeiter",
          is_admin: false,
          is_active: false,
          pending_approval: true,
        });
    const { error: dbErr } = await write;
    if (dbErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: "Registrierung fehlgeschlagen. Bitte später erneut versuchen." };
    }
    return { done: true };
  } catch {
    return { error: "Registrierung fehlgeschlagen. Bitte später erneut versuchen." };
  }
}
