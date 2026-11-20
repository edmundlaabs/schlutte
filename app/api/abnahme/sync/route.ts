import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";
import { docToRows } from "@/lib/abnahme/mapping";
import type { ProtokollDoc } from "@/lib/abnahme/types";
import { syncRegie } from "@/lib/abnahme/regie-sync";

export const dynamic = "force-dynamic";

type Body = { typ?: string; deviceId?: string; baseRev?: number; doc?: ProtokollDoc; regie?: unknown };

/**
 * Sync eines Dokuments vom Tablet. Reihenfolge: Protokollzeile (nie direkt „abgeschlossen“) →
 * Kinder → bei Abschluss zuletzt der Statuswechsel (sonst sperrt der Trigger die Kinder).
 * Voraussetzungen: Gerät hält den Checkout, rev stimmt, Dokument serverseitig noch nicht abgeschlossen.
 */
export async function POST(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.deviceId) return jsonFehler(400, "Ungültige Anfrage.");
  const supabase = await createClient();

  if (body.typ === "regie") return syncRegie(supabase, ctx, body as never);
  const doc = body.doc;
  if (body.typ !== "abnahme" || !doc?.id) return jsonFehler(400, "Ungültige Anfrage.");

  if (!doc.kommissionNr?.trim() || !doc.kunde?.trim()) return jsonFehler(422, "Kommissionsnummer und Kunde sind Pflicht.");

  const cur = await supabase
    .from("abnahme_protokolle")
    .select("id,status,rev,checkout_device")
    .eq("id", doc.id)
    .maybeSingle();
  if (cur.error) return jsonFehler(500, cur.error.message);
  const existiert = Boolean(cur.data);
  if (existiert) {
    if (cur.data!.status === "abgeschlossen") return jsonFehler(409, "Das Protokoll ist serverseitig bereits abgeschlossen.");
    if (cur.data!.checkout_device !== body.deviceId) return jsonFehler(409, "Das Protokoll ist auf einem anderen Gerät ausgecheckt.");
    if (typeof body.baseRev === "number" && cur.data!.rev !== body.baseRev) {
      return jsonFehler(409, "Das Protokoll wurde zwischenzeitlich geändert (Versionskonflikt).");
    }
  }
  const nextRev = (cur.data?.rev ?? 0) + 1;
  const abschluss = doc.status === "abgeschlossen";
  const rows = docToRows({ ...doc, mitarbeiterId: doc.mitarbeiterId ?? ctx.employee?.id ?? null });

  const fail = (what: string, message: string) => jsonFehler(500, `${what}: ${message}`);

  const p = await supabase.from("abnahme_protokolle").upsert({
    ...rows.protokoll,
    status: abschluss ? "in_arbeit" : doc.status,
    abgeschlossen_at: null,
    rev: nextRev,
    checkout_device: body.deviceId,
    checkout_user: ctx.employee?.id ?? null,
    checkout_at: new Date().toISOString(),
    created_by: existiert ? undefined : (ctx.employee?.id ?? null),
  });
  if (p.error) return fail("Protokoll", p.error.message);

  const tables: [string, Record<string, unknown>[]][] = [
    ["abnahme_raeume", rows.raeume],
    ["abnahme_positionen", rows.positionen],
    ["abnahme_pruefpunkte", rows.pruefpunkte],
    ["abnahme_maengel", rows.maengel],
    ["abnahme_fotos", rows.fotos],
    ["abnahme_unterschriften", rows.unterschriften],
  ];
  // Reihenfolge der Abhängigkeiten beim Schreiben: Räume → Positionen → Prüfpunkte → Mängel → Fotos/Unterschriften.
  for (const [table, list] of tables) {
    if (list.length) {
      const r = await supabase.from(table).upsert(list);
      if (r.error) return fail(table, r.error.message);
    }
  }
  // Gelöschtes entfernen (umgekehrte Reihenfolge wegen Fremdschlüsseln).
  for (const [table, list] of [...tables].reverse()) {
    const ids = list.map((r) => r.id as string);
    const q = supabase.from(table).delete().eq("protokoll_id", doc.id);
    const r = ids.length ? await q.not("id", "in", `(${ids.join(",")})`) : await q;
    if (r.error) return fail(table, r.error.message);
  }

  if (abschluss) {
    const f = await supabase
      .from("abnahme_protokolle")
      .update({ status: "abgeschlossen", abgeschlossen_at: doc.abgeschlossenAt ?? new Date().toISOString(), pdf_path: doc.pdfPath, checkout_device: null, checkout_user: null, checkout_at: null })
      .eq("id", doc.id);
    if (f.error) return fail("Abschluss", f.error.message);
  }
  return Response.json({ ok: true, rev: nextRev, abgeschlossen: abschluss });
}
