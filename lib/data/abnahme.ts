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
}
