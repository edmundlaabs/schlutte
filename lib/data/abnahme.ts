import { createClient } from "@/lib/supabase/server";
import { docToRows, rowToVorlage } from "@/lib/abnahme/mapping";
import type { ProtokollDoc, Vorlage } from "@/lib/abnahme/types";

export async function getVorlagen(): Promise<Vorlage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("abnahme_vorlagen").select("*").order("sort");
  if (error) throw new Error(`Vorlagen konnten nicht geladen werden: ${error.message}`);
  return (data ?? []).map(rowToVorlage);
}

export type KommissionTreffer = { id: string; nr: string; kunde: string; projekt: string };

export async function findKommission(nr: string): Promise<KommissionTreffer | null> {
  const clean = nr.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commissions")
    .select("id,commission_number,customer_name,project_name")
    .eq("commission_number", clean)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    nr: String(data.commission_number).trim(),
    kunde: data.customer_name ?? "",
    projekt: data.project_name ?? "",
  };
}

/**
 * Typeahead für die Kommissionsauswahl: Treffer nach Kommissionsnummer, Kundenname und Projekt (nur echte Zeilen,
 * keine Demo-Daten wie in lib/data/commissions.ts). Neueste Nummern zuerst, höchstens 10.
 */
export async function searchKommissionen(q: string): Promise<KommissionTreffer[]> {
  const clean = q.trim().replace(/[%,()*\\]/g, " ").trim();
  if (clean.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commissions")
    .select("id,commission_number,customer_name,project_name")
    .or(`commission_number.ilike.%${clean}%,customer_name.ilike.%${clean}%,project_name.ilike.%${clean}%`)
    .order("commission_number", { ascending: false })
    .limit(10);
  if (error) throw new Error(`Kommissionen konnten nicht gesucht werden: ${error.message}`);
  return (data ?? []).map((d) => ({
    id: d.id,
    nr: String(d.commission_number).trim(),
    kunde: d.customer_name ?? "",
    projekt: d.project_name ?? "",
  }));
}

/** Legt Protokoll mit Räumen, Positionen und Prüfpunkten an. Bei Fehler wird das Protokoll wieder entfernt. */
export async function insertProtokoll(doc: ProtokollDoc): Promise<void> {
  const supabase = await createClient();
  const rows = docToRows(doc);
  const fail = async (what: string, message: string): Promise<never> => {
    await supabase.from("abnahme_protokolle").delete().eq("id", doc.id);
    throw new Error(`${what}: ${message}`);
  };
  const p = await supabase.from("abnahme_protokolle").insert(rows.protokoll);
  if (p.error) throw new Error(`Protokoll: ${p.error.message}`);
  if (rows.raeume.length) {
    const r = await supabase.from("abnahme_raeume").insert(rows.raeume);
    if (r.error) await fail("Räume", r.error.message);
  }
  if (rows.positionen.length) {
    const r = await supabase.from("abnahme_positionen").insert(rows.positionen);
    if (r.error) await fail("Positionen", r.error.message);
  }
  if (rows.pruefpunkte.length) {
    const r = await supabase.from("abnahme_pruefpunkte").insert(rows.pruefpunkte);
    if (r.error) await fail("Prüfpunkte", r.error.message);
  }
  for (const [table, list] of [["abnahme_maengel", rows.maengel], ["abnahme_fotos", rows.fotos], ["abnahme_unterschriften", rows.unterschriften]] as const) {
    if (list.length) {
      const r = await supabase.from(table).insert(list);
      if (r.error) await fail(table, r.error.message);
    }
  }
}

// ─── Laden, Ablage, Versandprotokoll ─────────────────────────────────────────

import { rowsToDoc } from "@/lib/abnahme/mapping";

export async function ladeProtokollDoc(id: string): Promise<ProtokollDoc | null> {
  const supabase = await createClient();
  const [p, ra, po, pr, ma, fo, un] = await Promise.all([
    supabase.from("abnahme_protokolle").select("*").eq("id", id).maybeSingle(),
    supabase.from("abnahme_raeume").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_positionen").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_pruefpunkte").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_maengel").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_fotos").select("*").eq("protokoll_id", id),
    supabase.from("abnahme_unterschriften").select("*").eq("protokoll_id", id),
  ]);
  if (p.error || !p.data) return null;
  return rowsToDoc({
    protokoll: p.data, raeume: ra.data ?? [], positionen: po.data ?? [], pruefpunkte: pr.data ?? [],
    maengel: ma.data ?? [], fotos: fo.data ?? [], unterschriften: un.data ?? [],
  });
}

export type AblageEintrag = {
  typ: "abnahme" | "regie";
  id: string;
  kommission_nr: string;
  kunde: string;
  projekt: string | null;
  titel: string | null;
  status: string;
  version: number;
  mitarbeiter_name: string | null;
  datum: string;
  pdf_path: string | null;
  offeneMaengel: number;
};

export type AblageFilter = { q?: string; typ?: string; status?: string; mitarbeiter?: string; von?: string; bis?: string };

export async function listAblage(filter: AblageFilter): Promise<AblageEintrag[]> {
  const supabase = await createClient();
  const q = (filter.q ?? "").trim().replace(/[%,()]/g, " ");
  const out: AblageEintrag[] = [];

  if (!filter.typ || filter.typ === "abnahme") {
    let qb = supabase
      .from("abnahme_protokolle")
      .select("id,kommission_nr,kunde,projekt,titel,status,version,mitarbeiter_name,abgeschlossen_at,created_at,pdf_path")
      .order("created_at", { ascending: false })
      .limit(300);
    if (q) qb = qb.or(`kommission_nr.ilike.%${q}%,kunde.ilike.%${q}%`);
    if (filter.status) qb = qb.eq("status", filter.status);
    if (filter.mitarbeiter) qb = qb.ilike("mitarbeiter_name", `%${filter.mitarbeiter}%`);
    if (filter.von) qb = qb.gte("created_at", filter.von);
    if (filter.bis) qb = qb.lte("created_at", `${filter.bis}T23:59:59`);
    const { data } = await qb;
    const ids = (data ?? []).map((d) => d.id as string);
    const offen = new Map<string, number>();
    if (ids.length) {
      const m = await supabase.from("abnahme_maengel").select("protokoll_id").in("protokoll_id", ids).is("erledigt_at", null);
      for (const r of m.data ?? []) offen.set(r.protokoll_id as string, (offen.get(r.protokoll_id as string) ?? 0) + 1);
    }
    for (const d of data ?? []) {
      out.push({
        typ: "abnahme", id: d.id, kommission_nr: d.kommission_nr, kunde: d.kunde, projekt: d.projekt, titel: d.titel,
        status: d.status, version: d.version, mitarbeiter_name: d.mitarbeiter_name,
        datum: d.abgeschlossen_at ?? d.created_at, pdf_path: d.pdf_path,
        offeneMaengel: d.status === "abgeschlossen" ? (offen.get(d.id) ?? 0) : 0,
      });
    }
  }

  if (!filter.typ || filter.typ === "regie") {
    let qb = supabase
      .from("abnahme_regieberichte")
      .select("id,kommission_nr,kunde,status,mitarbeiter_name,datum,created_at,pdf_path")
      .order("created_at", { ascending: false })
      .limit(300);
    if (q) qb = qb.or(`kommission_nr.ilike.%${q}%,kunde.ilike.%${q}%`);
    if (filter.status) qb = qb.eq("status", filter.status === "abgeschlossen" ? "abgeschlossen" : "entwurf");
    if (filter.mitarbeiter) qb = qb.ilike("mitarbeiter_name", `%${filter.mitarbeiter}%`);
    if (filter.von) qb = qb.gte("datum", filter.von);
    if (filter.bis) qb = qb.lte("datum", filter.bis);
    const { data } = await qb;
    for (const d of data ?? []) {
      out.push({
        typ: "regie", id: d.id, kommission_nr: d.kommission_nr, kunde: d.kunde, projekt: null, titel: null,
        status: d.status, version: 1, mitarbeiter_name: d.mitarbeiter_name, datum: d.datum ?? d.created_at,
        pdf_path: d.pdf_path, offeneMaengel: 0,
      });
    }
  }
  return out.sort((a, b) => b.datum.localeCompare(a.datum));
}

export type VersandEintrag = {
  id: string; an: string; kopie: string | null; status: string; fehler: string | null;
  ausgeloest_at: string; gesendet_at: string | null; ausgeloest_von_name: string | null;
};

export async function listVersand(typ: "abnahme" | "regie", id: string): Promise<VersandEintrag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("abnahme_versand")
    .select("id,an,kopie,status,fehler,ausgeloest_at,gesendet_at,ausgeloest_von")
    .eq("dokument_typ", typ)
    .eq("dokument_id", id)
    .order("ausgeloest_at", { ascending: false });
  const ids = Array.from(new Set((data ?? []).map((d) => d.ausgeloest_von).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const e = await supabase.from("employees").select("id,name").in("id", ids);
    for (const r of e.data ?? []) names.set(r.id as string, (r.name as string) ?? "");
  }
  return (data ?? []).map((d) => ({
    id: d.id, an: d.an, kopie: d.kopie, status: d.status, fehler: d.fehler,
    ausgeloest_at: d.ausgeloest_at, gesendet_at: d.gesendet_at,
    ausgeloest_von_name: d.ausgeloest_von ? names.get(d.ausgeloest_von) ?? null : null,
  }));
}

/** Alle Versionen eines Protokolls (Kette über parent_id), neueste zuerst. */
export async function listVersionen(id: string): Promise<{ id: string; version: number; status: string; abgeschlossen_at: string | null }[]> {
  const supabase = await createClient();
  const kette: { id: string; version: number; status: string; abgeschlossen_at: string | null; parent_id: string | null }[] = [];
  type Zeile = { id: string; version: number; status: string; abgeschlossen_at: string | null; parent_id: string | null };
  let cur: string | null = id;
  // zur Wurzel hoch
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const res = await supabase.from("abnahme_protokolle").select("id,version,status,abgeschlossen_at,parent_id").eq("id", cur).maybeSingle();
    const zeile = res.data as Zeile | null;
    if (!zeile) break;
    kette.push(zeile);
    cur = zeile.parent_id;
  }
  const wurzel = kette[kette.length - 1]?.id ?? id;
  // alle Nachfolger der Wurzel einsammeln
  const alle = new Map(kette.map((k) => [k.id, k]));
  let front = [wurzel];
  while (front.length) {
    const r = await supabase.from("abnahme_protokolle").select("id,version,status,abgeschlossen_at,parent_id").in("parent_id", front);
    front = [];
    for (const k of r.data ?? []) if (!alle.has(k.id)) { alle.set(k.id, k); front.push(k.id); }
  }
  return Array.from(alle.values()).sort((a, b) => b.version - a.version);
}
