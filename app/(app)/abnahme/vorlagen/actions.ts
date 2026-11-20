"use server";

import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createClient } from "@/lib/supabase/server";
import { parsePunkte } from "@/lib/abnahme/vorlagen";

export type VorlagenResult = { ok: true } | { ok: false; error: string };

async function nurAdmin() {
  const ctx = await requireAppAccess("abnahme");
  if (!ctx.isFinance) throw new Error("Nur CEO und Administratoren dürfen Vorlagen pflegen.");
}

export async function speichereVorlage(input: {
  id?: string; moebeltyp: string; titelDe: string; titelEn: string; punkteText: string; aktiv: boolean; sort: number;
}): Promise<VorlagenResult> {
  try {
    await nurAdmin();
    const moebeltyp = input.moebeltyp.trim();
    if (!moebeltyp) return { ok: false, error: "Möbeltyp ist Pflicht." };
    const row = {
      moebeltyp,
      titel_de: input.titelDe.trim() || moebeltyp,
      titel_en: input.titelEn.trim() || input.titelDe.trim() || moebeltyp,
      punkte: parsePunkte(input.punkteText),
      aktiv: input.aktiv,
      sort: Math.trunc(input.sort) || 0,
    };
    const supabase = await createClient();
    const r = input.id ? await supabase.from("abnahme_vorlagen").update(row).eq("id", input.id) : await supabase.from("abnahme_vorlagen").insert(row);
    if (r.error) return { ok: false, error: r.error.message };
    revalidatePath("/abnahme/vorlagen");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}

export async function loescheVorlage(id: string): Promise<VorlagenResult> {
  try {
    await nurAdmin();
    const supabase = await createClient();
    const r = await supabase.from("abnahme_vorlagen").delete().eq("id", id);
    if (r.error) return { ok: false, error: r.error.message };
    revalidatePath("/abnahme/vorlagen");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Löschen fehlgeschlagen." };
  }
}
