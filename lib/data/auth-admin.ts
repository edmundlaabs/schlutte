import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auth-Admin-Operationen (Supabase GoTrue) — nur serverseitig, nur nach requireAdmin().
 * Die Verknüpfung Mitarbeiter ↔ Login erfolgt über die E-Mail-Adresse (Login-Identität).
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Alle Login-E-Mails (lowercase) aus auth.users — für die Anzeige des Login-Status. */
export async function getLoginEmails(): Promise<Set<string>> {
  const admin = createAdminClient();
  const emails = new Set<string>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Login-Liste fehlgeschlagen: ${error.message}`);
    for (const u of data.users) {
      if (u.email) emails.add(u.email.toLowerCase());
    }
    if (data.users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return emails;
}

/** Sucht die Auth-User-ID zu einer E-Mail (case-insensitive). null = kein Login vorhanden. */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  if (!target) return null;

  // Für kleine Teams reicht eine Seite; bei Bedarf blättern wir weiter.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Login-Suche fehlgeschlagen: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null; // letzte Seite erreicht
    page += 1;
    if (page > 50) return null; // Sicherheitsnetz
  }
}

/**
 * Setzt das Passwort für die E-Mail. Existiert noch kein Login, wird er angelegt
 * (E-Mail direkt bestätigt, damit sofort angemeldet werden kann).
 * Rückgabe: "created" = neuer Login, "updated" = Passwort geändert.
 */
export async function setPasswordForEmail(
  email: string,
  password: string
): Promise<"created" | "updated"> {
  const admin = createAdminClient();
  const mail = email.trim();
  if (!mail) throw new Error("Für ein Login wird eine E-Mail-Adresse benötigt.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  }

  const existingId = await findAuthUserIdByEmail(mail);

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, { password });
    if (error) throw new Error(`Passwort konnte nicht gesetzt werden: ${error.message}`);
    return "updated";
  }

  const { error } = await admin.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Login konnte nicht angelegt werden: ${error.message}`);
  return "created";
}

/** Entfernt den Login zu einer E-Mail (falls vorhanden). Best-effort. */
export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const mail = email.trim();
  if (!mail) return;
  const id = await findAuthUserIdByEmail(mail);
  if (!id) return;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`Login konnte nicht gelöscht werden: ${error.message}`);
}

/**
 * Lädt per E-Mail ein (Supabase sendet einen Link; Ziel: /passwort-neu).
 * Existiert schon ein Login, passiert nichts ("exists"). Redirect-URL muss in
 * Supabase unter Authentication → URL Configuration freigegeben sein.
 */
export async function inviteUserByEmail(
  email: string,
  redirectTo: string
): Promise<"invited" | "exists"> {
  const mail = email.trim();
  if (!mail) throw new Error("Für eine Einladung wird eine E-Mail-Adresse benötigt.");
  if (await findAuthUserIdByEmail(mail)) return "exists";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(mail, { redirectTo });
  if (error) throw new Error(`Einladung fehlgeschlagen: ${error.message}`);
  return "invited";
}

/**
 * Sperrt bzw. entsperrt den Login zur E-Mail (Ban). Kein Login → false.
 * Bereits ausgestellte Sitzungen laufen bis zum Ablauf des Tokens weiter.
 */
export async function setAuthUserBanned(email: string, banned: boolean): Promise<boolean> {
  const mail = email.trim();
  if (!mail) return false;
  const id = await findAuthUserIdByEmail(mail);
  if (!id) return false;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) throw new Error(`Login konnte nicht ${banned ? "gesperrt" : "entsperrt"} werden: ${error.message}`);
  return true;
}

/**
 * Mitarbeiter, die sich anmelden können (aktiv + Login vorhanden) — für den
 * Namens-Dropdown der Login-Seite. Liefert nur id und Name, nie E-Mails.
 */
export async function getLoginChoices(): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const [{ data, error }, loginEmails] = await Promise.all([
    admin.from("employees").select("id, name, email").eq("is_active", true).order("name"),
    getLoginEmails(),
  ]);
  if (error) throw new Error(`Mitarbeiterliste fehlgeschlagen: ${error.message}`);
  return (data ?? [])
    .filter((e) => e.email && loginEmails.has(String(e.email).toLowerCase()))
    .map((e) => ({ id: String(e.id), name: String(e.name) }));
}
