"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  deleteEmployee,
  getEmployeeById,
} from "@/lib/data/employees";
import {
  setPasswordForEmail,
  deleteAuthUserByEmail,
  inviteUserByEmail,
  setAuthUserBanned,
  MIN_PASSWORD_LENGTH,
} from "@/lib/data/auth-admin";
import { isSyntheticLoginEmail, syntheticLoginEmail } from "@/lib/auth/login-email";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { parseAppRole } from "@/lib/auth/app-role";
import { parseAppKeys } from "@/lib/apps";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/types";

/**
 * Formular → App-Freischaltungen. Das Formular sendet apps_present, damit
 * "nichts angehakt" (= keine Apps) von "Feld nicht im Formular" unterscheidbar ist.
 */
function appAccessFromForm(formData: FormData) {
  if (formData.get("apps_present") !== "1") return undefined;
  return parseAppKeys(formData.getAll("apps"));
}

async function passwordRedirectUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/passwort-neu`;
}

export async function createEmployeeAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const input: CreateEmployeeInput = {
    initials: (formData.get("initials") as string) ?? "",
    name: (formData.get("name") as string) ?? "",
    email: (formData.get("email") as string) || undefined,
    // is_admin wird im Data-Layer aus der Rolle abgeleitet (role === "admin").
    role: parseAppRole(formData.get("role")),
    // Nicht angehakte Checkboxen fehlen im FormData → inaktiv.
    is_active: formData.get("is_active") === "true",
    app_access: appAccessFromForm(formData),
  };
  const password = ((formData.get("password") as string) ?? "").trim();

  try {
    await requireAdmin();

    // Optionales Login: nur wenn ein Passwort gesetzt wurde.
    if (password) {
      // Ohne E-Mail: technische Login-Adresse aus dem Kürzel (Anmeldung per Namens-Dropdown).
      if (!input.email?.trim()) {
        input.email = syntheticLoginEmail(input.initials);
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return { error: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` };
      }
    }

    await createEmployee(input);

    // Login erst nach erfolgreichem Anlegen des Datensatzes erzeugen.
    if (password && input.email) {
      await setPasswordForEmail(input.email, password);
    } else if (input.email?.trim() && input.is_active) {
      // Kein Passwort vergeben → per E-Mail einladen (Link führt auf /passwort-neu).
      // Schlägt der Versand fehl, bleibt der Mitarbeiter angelegt; Meldung folgt.
      try {
        await inviteUserByEmail(input.email, await passwordRedirectUrl());
      } catch (e) {
        revalidatePath("/admin/mitarbeiter");
        return {
          error: `Mitarbeiter angelegt, aber die Einladung ging nicht raus: ${(e as Error).message}`,
        };
      }
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/admin/mitarbeiter");
  redirect("/admin/mitarbeiter");
}

export async function updateEmployeeAction(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const input: UpdateEmployeeInput = {
    initials: (formData.get("initials") as string) ?? undefined,
    name: (formData.get("name") as string) ?? undefined,
    email: (formData.get("email") as string) || undefined,
    role: parseAppRole(formData.get("role")),
    is_active: formData.get("is_active") === "true",
    app_access: appAccessFromForm(formData),
  };

  try {
    await requireAdmin();
    await updateEmployee(id, input);
    // Login-Sperre mit dem Aktiv-Flag synchron halten.
    if (input.is_active !== undefined && input.email?.trim()) {
      await setAuthUserBanned(input.email, !input.is_active);
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/admin/mitarbeiter");
  redirect("/admin/mitarbeiter");
}

/**
 * Passwort setzen bzw. zurücksetzen. Der Schlutte-Login gilt für alle Apps, die
 * am selben Supabase-Projekt hängen (auch Gerda). Existiert noch kein Login zur
 * E-Mail des Mitarbeiters, wird er angelegt.
 */
export async function setPasswordAction(
  employeeId: string,
  _prev: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const password = ((formData.get("password") as string) ?? "").trim();

  try {
    await requireAdmin();

    const employee = await getEmployeeById(employeeId);
    if (!employee) return { error: "Mitarbeiter nicht gefunden." };
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` };
    }

    // Keine E-Mail hinterlegt: technische Login-Adresse erzeugen und beim Mitarbeiter speichern.
    let email = employee.email?.trim() ?? "";
    if (!email) {
      email = syntheticLoginEmail(employee.initials ?? "");
      await updateEmployee(employeeId, { email });
    }

    const result = await setPasswordForEmail(email, password);
    revalidatePath("/admin/mitarbeiter");
    const who = isSyntheticLoginEmail(email) ? employee.name : email;
    return {
      success:
        result === "created" ? `Login für ${who} angelegt.` : `Passwort für ${who} aktualisiert.`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleActiveAction(
  id: string,
  active: boolean
): Promise<void> {
  await requireAdmin();
  await setEmployeeActive(id, active);
  // Login mitsperren/entsperren. Fehlt der Service-Role-Key, bleibt der Flag trotzdem gesetzt.
  const employee = await getEmployeeById(id);
  if (employee?.email) {
    try {
      await setAuthUserBanned(employee.email, !active);
    } catch (e) {
      console.warn("Login-Sperre nicht angepasst:", (e as Error).message);
    }
  }
  revalidatePath("/admin/mitarbeiter");
  revalidatePath("/admin/zugaenge");
}

export async function deleteEmployeeAction(
  id: string
): Promise<{ softOnly: boolean; error?: string }> {
  try {
    await requireAdmin();

    // E-Mail vor dem Löschen merken, um den zugehörigen Login zu entfernen.
    const employee = await getEmployeeById(id);
    const result = await deleteEmployee(id);

    // Login nur bei echtem Löschen (nicht bei Soft-Delete) entfernen.
    if (!result.softOnly && employee?.email) {
      try {
        await deleteAuthUserByEmail(employee.email);
      } catch (e) {
        console.warn("Login konnte nicht entfernt werden:", (e as Error).message);
      }
    }

    revalidatePath("/admin/mitarbeiter");
    return { softOnly: result.softOnly };
  } catch (e) {
    return { softOnly: false, error: (e as Error).message };
  }
}
