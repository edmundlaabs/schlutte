"use server";

import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createClient } from "@/lib/supabase/server";
import { parsePunkte } from "@/lib/abnahme/vorlagen";
import { protokollVorlageToRow } from "@/lib/abnahme/mapping";
import { bereinigeStruktur } from "@/lib/abnahme/protokoll-vorlagen";
import type { VorlageRaum } from "@/lib/abnahme/types";

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

export type ProtokollVorlageInput = {
  id?: string; titelDe: string; titelEn: string; beschreibung: string; raeume: VorlageRaum[]; aktiv: boolean; sort: number;
};

/** Protokoll-Vorlage anlegen/ändern (Admin) – auch für „Als Vorlage speichern“ aus dem Editor (ohne id). */
export async function speichereProtokollVorlage(input: ProtokollVorlageInput): Promise<VorlagenResult> {
  try {
    await nurAdmin();
    if (!input.titelDe.trim()) return { ok: false, error: "Name der Vorlage ist Pflicht." };
    const raeume = bereinigeStruktur(input.raeume);
    if (raeume.length === 0 || raeume.every((r) => r.positionen.length === 0)) {
      return { ok: false, error: "Die Vorlage braucht mindestens einen Raum mit einer Position." };
    }
    const row = protokollVorlageToRow({ ...input, raeume });
    const supabase = await createClient();
    const r = input.id
      ? await supabase.from("abnahme_protokoll_vorlagen").update(row).eq("id", input.id)
      : await supabase.from("abnahme_protokoll_vorlagen").insert(row);
    if (r.error) return { ok: false, error: r.error.message };
    revalidatePath("/abnahme/vorlagen");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}

export async function loescheProtokollVorlage(id: string): Promise<VorlagenResult> {
  try {
    await nurAdmin();
    const supabase = await createClient();
    const r = await supabase.from("abnahme_protokoll_vorlagen").delete().eq("id", id);
    if (r.error) return { ok: false, error: r.error.message };
    revalidatePath("/abnahme/vorlagen");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Löschen fehlgeschlagen." };
  }
}
