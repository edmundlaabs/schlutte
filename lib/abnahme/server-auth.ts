import { appAccessOf } from "@/lib/auth/app-access";
import { getCurrentUserContext, type UserContext } from "@/lib/auth/roles";

/** Für Route Handlers: Nutzer mit Freischaltung „abnahme“ – sonst null (Aufrufer antwortet 401/403). */
export async function abnahmeNutzer(): Promise<UserContext | null> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;
  return appAccessOf(ctx).includes("abnahme") ? ctx : null;
}

export function jsonFehler(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}
