import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/roles";
import { jsonFehler } from "@/lib/abnahme/server-auth";
import { regieToRows } from "@/lib/abnahme/regie-logic";
import type { RegieDoc } from "@/lib/abnahme/types";

/** Sync eines Regiebericht-Entwurfs/-Abschlusses vom Tablet (gleiche Regeln wie beim Protokoll). */
export async function syncRegie(supabase: SupabaseClient, ctx: UserContext, body: { deviceId?: string; baseRev?: number; regie?: RegieDoc }): Promise<Response> {
  const doc = body.regie;
  if (!doc?.id || !body.deviceId) return jsonFehler(400, "Ungültige Anfrage.");
  if (!doc.kommissionNr?.trim() || !doc.kunde?.trim()) return jsonFehler(422, "Kommissionsnummer und Kunde sind Pflicht.");

  const cur = await supabase.from("abnahme_regieberichte").select("id,status,rev,checkout_device").eq("id", doc.id).maybeSingle();
  if (cur.error) return jsonFehler(500, cur.error.message);
  const existiert = Boolean(cur.data);
  // Schon einmal synchronisiert (rev > 0), aber auf dem Server weg = gelöscht: nicht neu anlegen.
  if (!existiert && (doc.rev ?? 0) > 0) return jsonFehler(410, "Dieser Regiebericht wurde auf dem Server gelöscht. Lokale Kopie bitte verwerfen.");
  if (existiert) {
    if (cur.data!.status === "abgeschlossen") return jsonFehler(409, "Der Regiebericht ist serverseitig bereits abgeschlossen.");
    if (cur.data!.checkout_device && cur.data!.checkout_device !== body.deviceId) return jsonFehler(409, "Der Regiebericht ist auf einem anderen Gerät ausgecheckt.");
    if (typeof body.baseRev === "number" && body.baseRev !== 0 && cur.data!.rev !== body.baseRev) return jsonFehler(409, "Der Regiebericht wurde zwischenzeitlich geändert (Versionskonflikt).");
  }
  const nextRev = (cur.data?.rev ?? 0) + 1;
  const abschluss = doc.status === "abgeschlossen";

  // Kommission über die Nummer verknüpfen (offline angelegt → erst jetzt prüfbar).
  let commissionId = doc.commissionId;
  if (!commissionId) {
    const k = await supabase.from("commissions").select("id").eq("commission_number", doc.kommissionNr.trim()).maybeSingle();
    commissionId = k.data?.id ?? null;
  }
  const rows = regieToRows({ ...doc, commissionId, mitarbeiterId: doc.mitarbeiterId ?? ctx.employee?.id ?? null });

  const p = await supabase.from("abnahme_regieberichte").upsert({
    ...rows.regie,
    status: "entwurf",
    anerkannt_at: null,
    rev: nextRev,
    checkout_device: body.deviceId,
    checkout_user: ctx.employee?.id ?? null,
    checkout_at: new Date().toISOString(),
    created_by: existiert ? undefined : (ctx.employee?.id ?? null),
  });
  if (p.error) return jsonFehler(500, `Regiebericht: ${p.error.message}`);

  if (rows.zeilen.length) {
    const z = await supabase.from("abnahme_regie_zeilen").upsert(rows.zeilen);
    if (z.error) return jsonFehler(500, `Zeilen: ${z.error.message}`);
  }
  const ids = rows.zeilen.map((r) => r.id as string);
  const q = supabase.from("abnahme_regie_zeilen").delete().eq("regiebericht_id", doc.id);
  const d = ids.length ? await q.not("id", "in", `(${ids.join(",")})`) : await q;
  if (d.error) return jsonFehler(500, `Zeilen: ${d.error.message}`);

  if (abschluss) {
    const f = await supabase
      .from("abnahme_regieberichte")
      .update({ status: "abgeschlossen", anerkannt_at: doc.anerkanntAt ?? new Date().toISOString(), pdf_path: doc.pdfPath, unterschrift_path: doc.unterschriftPath, checkout_device: null, checkout_user: null, checkout_at: null })
      .eq("id", doc.id);
    if (f.error) return jsonFehler(500, `Abschluss: ${f.error.message}`);
  }
  return Response.json({ ok: true, rev: nextRev, abgeschlossen: abschluss });
}
