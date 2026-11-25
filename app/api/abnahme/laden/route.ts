import { createClient } from "@/lib/supabase/server";
import { getActiveEmployees } from "@/lib/data/employees";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";
import { rowsToDoc, rowToVorlage } from "@/lib/abnahme/mapping";

export const dynamic = "force-dynamic";

/**
 * „Für Baustelle laden“: liefert alle Daten
 * (inkl. Vorlagen, Mitarbeiterliste, angemeldeter Nutzer, signierte URLs vorhandener Bilder).
 */
export async function POST(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const body = (await request.json().catch(() => null)) as { typ?: string; id?: string; deviceId?: string; force?: boolean } | null;
  if (!body?.id || !body.deviceId || (body.typ !== "abnahme" && body.typ !== "regie")) return jsonFehler(400, "Ungültige Anfrage.");

  const supabase = await createClient();
  // Abnahmeprotokolle werden nicht mehr ausgecheckt: mehrere Geräte dürfen laden und bearbeiten, der Sync gleicht ab.
  // Nur der Regiebericht hält noch einen Checkout.
  if (body.typ === "regie") {
    const co = await supabase.rpc("abnahme_checkout", { p_typ: body.typ, p_id: body.id, p_device: body.deviceId, p_force: Boolean(body.force) });
    if (co.error) return jsonFehler(403, co.error.message);
    if (co.data === false) return jsonFehler(409, "Dieses Dokument ist auf einem anderen Gerät ausgecheckt.");
  }

  const me = { id: ctx.employee?.id ?? null, name: ctx.employee?.name ?? ctx.email ?? "" };
  const employees = (await getActiveEmployees())
    .filter((e) => e.id && e.is_active !== false)
    .map((e) => ({ id: e.id as string, name: e.name }));
  const vorlagenRes = await supabase.from("abnahme_vorlagen").select("*").order("sort");
  const vorlagen = (vorlagenRes.data ?? []).map(rowToVorlage);

  if (body.typ === "regie") {
    const reg = await supabase.from("abnahme_regieberichte").select("*").eq("id", body.id).single();
    if (reg.error) return jsonFehler(404, reg.error.message);
    const zeilen = await supabase.from("abnahme_regie_zeilen").select("*").eq("regiebericht_id", body.id).order("pos");
    return Response.json({ ok: true, typ: "regie", row: reg.data, zeilen: zeilen.data ?? [], vorlagen, employees, me, signed: {} });
  }

  const id = body.id;
  const [p, ra, po, pr, ma, fo, un] = await Promise.all([
    supabase.from("abnahme_protokolle").select("*").eq("id", id).single(),
    supabase.from("abnahme_raeume").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_positionen").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_pruefpunkte").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_maengel").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_fotos").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_unterschriften").select("*").eq("protokoll_id", id),
  ]);
  if (p.error) return jsonFehler(404, p.error.message);
  const doc = rowsToDoc({
    protokoll: p.data, raeume: ra.data ?? [], positionen: po.data ?? [], pruefpunkte: pr.data ?? [],
    maengel: ma.data ?? [], fotos: fo.data ?? [], unterschriften: un.data ?? [],
  });
  if (doc.status === "abgeschlossen") return jsonFehler(409, "Das Protokoll ist bereits abgeschlossen.");

  // Bereits hochgeladene Bilder (z. B. bei Gerätewechsel) für die Offline-Nutzung bereitstellen.
  const paths = [...doc.fotos.map((f) => f.path), ...doc.unterschriften.map((u) => u.bildPath)].filter((x): x is string => Boolean(x));
  const signed: Record<string, string> = {};
  if (paths.length) {
    const res = await supabase.storage.from("abnahme").createSignedUrls(paths, 3600);
    for (const e of res.data ?? []) if (e.path && e.signedUrl) signed[e.path] = e.signedUrl;
  }
  if (doc.status === "bereit") doc.status = "in_arbeit";
  return Response.json({ ok: true, typ: "abnahme", doc, vorlagen, employees, me, signed });
}
