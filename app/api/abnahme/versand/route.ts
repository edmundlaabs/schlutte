import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";
import { versendeDokument } from "@/lib/abnahme/versand-server";

export const dynamic = "force-dynamic";

/** Versand eines synchronisierten Dokuments (auch aus der Offline-Vormerkung nach dem Sync). */
export async function POST(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const b = (await request.json().catch(() => null)) as { typ?: string; id?: string; an?: string; kopie?: string; schluessel?: string } | null;
  if (!b?.id || !b.an || (b.typ !== "abnahme" && b.typ !== "regie")) return jsonFehler(400, "Ungültige Anfrage.");
  const r = await versendeDokument({ typ: b.typ, id: b.id, an: b.an, kopie: b.kopie, schluessel: b.schluessel, ausgeloestVon: ctx.employee?.id ?? null });
  if (!r.ok) return Response.json(r, { status: r.nichtKonfiguriert ? 503 : 422 });
  return Response.json(r);
}
