import { requireUser } from "@/lib/auth/roles";
import { appAccessOf } from "@/lib/auth/app-access";
import { hasAdminRights } from "@/lib/auth/app-role";
import { UrlaubError } from "./fehler.ts";

export type UrlaubKontext = { employeeId: string; name: string; isAdmin: boolean };

/** Für Server Actions: angemeldet, App „urlaub“ freigeschaltet, Mitarbeiter-Datensatz vorhanden. */
export async function requireUrlaub(): Promise<UrlaubKontext> {
  const ctx = await requireUser();
  if (!appAccessOf(ctx).includes("urlaub")) throw new UrlaubError("Kein Zugriff auf das Urlaub-Modul.");
  const employeeId = ctx.employee?.id;
  if (!employeeId) throw new UrlaubError("Für dein Konto gibt es keinen Mitarbeiter-Eintrag. Bitte an einen Administrator wenden.");
  return { employeeId, name: ctx.employee?.name ?? "", isAdmin: hasAdminRights(ctx.role) };
}

/** Wie requireUrlaub, zusätzlich CEO/Admin. */
export async function requireUrlaubAdmin(): Promise<UrlaubKontext> {
  const k = await requireUrlaub();
  if (!k.isAdmin) throw new UrlaubError("Nur CEO und Administratoren dürfen diese Aktion ausführen.");
  return k;
}
