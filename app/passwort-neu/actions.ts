"use server";

import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/data/auth-admin";

export type PasswordResetState = { error?: string; success?: boolean } | null;

/**
 * Neues Passwort für den angemeldeten Nutzer setzen (Recovery-Link oder bestehende
 * Sitzung). Gilt global: ein Supabase-Login für die Schlutte und alle Apps am
 * selben Projekt (auch Gerda).
 */
export async function completePasswordResetAction(
  _prev: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  const password = ((formData.get("password") as string) ?? "").trim();
  const confirm = ((formData.get("confirm") as string) ?? "").trim();

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` };
  }
  if (password !== confirm) {
    return { error: "Die beiden Passwörter stimmen nicht überein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Der Link ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Das Passwort konnte nicht gesetzt werden: ${error.message}` };
  }

  return { success: true };
}
