import { redirect } from "next/navigation";
import { getCurrentUserContext, type UserContext } from "@/lib/auth/roles";
import { hasAdminRights } from "@/lib/auth/app-role";
import { resolveAppAccess, type AppKey } from "@/lib/apps";

/** Freigeschaltete Apps des angemeldeten Nutzers (ohne Mitarbeiter-Datensatz: keine). */
export function appAccessOf(ctx: UserContext | null): AppKey[] {
  if (!ctx) return [];
  if (hasAdminRights(ctx.role)) return resolveAppAccess(null, true);
  if (!ctx.employee) return [];
  return resolveAppAccess(ctx.employee.app_access, false);
}

/**
 * Serverseitiger Zugriffsschutz für eine interne App (in Layouts/Seiten aufrufen).
 * Nicht angemeldet → Login, nicht freigeschaltet → Startseite mit Hinweis.
 */
export async function requireAppAccess(app: AppKey): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!appAccessOf(ctx).includes(app)) {
    redirect(`/?kein-zugriff=${app}`);
  }
  return ctx;
}
