import { createClient } from "@/lib/supabase/server";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";
import { docToRows } from "@/lib/abnahme/mapping";
import type { ProtokollDoc } from "@/lib/abnahme/types";
import { syncRegie } from "@/lib/abnahme/regie-sync";
import { ladeProtokollDoc } from "@/lib/data/abnahme";
import type { RegieStandArchiv, StandArchiv } from "@/lib/abnahme/staende";

export const dynamic = "force-dynamic";

type Body = { typ?: string; deviceId?: string; baseRev?: number; doc?: ProtokollDoc; regie?: unknown; archiv?: StandArchiv | RegieStandArchiv };

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

  // Die Kommissionsnummer darf leer sein (Protokoll ohne Kommission); der Kunde ist immer Pflicht.
  if (!doc.kunde?.trim()) return jsonFehler(422, "Der Kundenname ist Pflicht.");

  const cur = await supabase
    .from("abnahme_protokolle")
    .select("id,status,rev")
    .eq("id", doc.id)
    .maybeSingle();
  if (cur.error) return jsonFehler(500, cur.error.message);
  const existiert = Boolean(cur.data);
  // Protokolle entstehen immer online (Import/manuell): fehlt die Zeile, wurde das Protokoll gelöscht – nicht neu anlegen.
  if (!existiert) return jsonFehler(410, "Dieses Protokoll wurde auf dem Server gelöscht. Lokale Kopie bitte verwerfen.");
  if (cur.data!.status === "abgeschlossen") return jsonFehler(409, "Das Protokoll ist serverseitig bereits abgeschlossen.");
  // Kein Auschecken: Hat sich der Server-Stand seit dem letzten Abgleich verändert (anderes Gerät, Büro), wird nichts
  // überschrieben, sondern der Server-Stand zurückgegeben – das Gerät gleicht ihn mit dem Nutzer ab.
  if (typeof body.baseRev === "number" && cur.data!.rev !== body.baseRev) {
    const serverDoc = await ladeProtokollDoc(doc.id);
    if (!serverDoc) return jsonFehler(500, "Server-Stand konnte nicht gelesen werden.");
    const paths = [...serverDoc.fotos.map((f) => f.path), ...serverDoc.unterschriften.map((u) => u.bildPath)].filter((x): x is string => Boolean(x));
    const signed: Record<string, string> = {};
    if (paths.length) {
      const res = await supabase.storage.from("abnahme").createSignedUrls(paths, 3600);
      for (const e of res.data ?? []) if (e.path && e.signedUrl) signed[e.path] = e.signedUrl;
    }
    return Response.json({ ok: false, konflikt: true, error: "Das Protokoll wurde zwischenzeitlich geändert (Abgleich nötig).", serverDoc, signed }, { status: 409 });
  }
  // Nach einem Abgleich: beide Stände archivieren (Tablet-Stand vor dem Abgleich, Server-Stand vor dem Abgleich).
  if (body.archiv?.tablet && body.archiv?.server) {
    const jetzt = new Date().toISOString();
    const a = await supabase.from("abnahme_staende").insert([
      { protokoll_id: doc.id, art: "tablet", rev: body.baseRev ?? 0, geraet: body.deviceId, erstellt_von: ctx.employee?.id ?? null, doc: body.archiv.tablet, created_at: jetzt },
      { protokoll_id: doc.id, art: "server", rev: cur.data!.rev, geraet: body.deviceId, erstellt_von: ctx.employee?.id ?? null, doc: body.archiv.server, created_at: jetzt },
    ]);
    if (a.error) return jsonFehler(500, `Archiv: ${a.error.message}`);
  }
  const nextRev = (cur.data?.rev ?? 0) + 1;
  const abschluss = doc.status === "abgeschlossen";
  const rows = docToRows({ ...doc, mitarbeiterId: doc.mitarbeiterId ?? ctx.employee?.id ?? null });
  // Die Herkunft legt allein der Server fest (beim Anlegen): ein älteres Tablet-Dokument ohne „quelle“
  // würde sonst „manuell“/„vorlage“ auf „profacto“ zurücksetzen.
  delete (rows.protokoll as Record<string, unknown>).quelle;

  const fail = (what: string, message: string) => jsonFehler(500, `${what}: ${message}`);

  const p = await supabase.from("abnahme_protokolle").upsert({
    ...rows.protokoll,
    status: abschluss ? "in_arbeit" : doc.status,
    abgeschlossen_at: null,
    rev: nextRev,
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
      .update({ status: "abgeschlossen", abgeschlossen_at: doc.abgeschlossenAt ?? new Date().toISOString(), pdf_path: doc.pdfPath })
      .eq("id", doc.id);
    if (f.error) return fail("Abschluss", f.error.message);
  }
  return Response.json({ ok: true, rev: nextRev, abgeschlossen: abschluss });
}
