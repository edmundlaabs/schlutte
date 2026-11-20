"use server";

import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createCommission } from "@/lib/data/commissions";
import { findKommission, insertProtokoll, ladeProtokollDoc, type KommissionTreffer } from "@/lib/data/abnahme";
import { createClient } from "@/lib/supabase/server";
import { versendeDokument } from "@/lib/abnahme/versand-server";
import { erzeugeNachtrag } from "@/lib/abnahme/nachtrag";
import type { ProtokollDoc } from "@/lib/abnahme/types";

export type AbnahmeResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function findeKommissionAction(nr: string): Promise<KommissionTreffer | null> {
  await requireAppAccess("abnahme");
  return findKommission(nr);
}

/**
 * Legt ein importiertes Protokoll an. Kommissionsnummer und Kunde sind Pflicht.
 * Existiert die Kommission nicht, wird sie nur auf ausdrücklichen Wunsch angelegt.
 */
export async function legeProtokollAn(
  doc: ProtokollDoc,
  optionen: { kommissionAnlegen: boolean }
): Promise<AbnahmeResult<{ id: string }>> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const nr = doc.kommissionNr.trim();
    const kunde = doc.kunde.trim();
    if (!nr) return { ok: false, error: "Kommissionsnummer ist Pflicht." };
    if (!kunde) return { ok: false, error: "Kundenname ist Pflicht." };
    if (!doc.positionen.some((p) => p.relevant)) {
      return { ok: false, error: "Es gibt keine abnahmerelevante Position." };
    }
    if (doc.positionen.some((p) => p.relevant && !p.raumId)) {
      return { ok: false, error: "Jede abnahmerelevante Position braucht einen Raum." };
    }

    let treffer = await findKommission(nr);
    if (!treffer) {
      if (!optionen.kommissionAnlegen) {
        return { ok: false, error: `Kommission ${nr} existiert nicht. Bitte verknüpfen oder zum Anlegen freigeben.` };
      }
      const angelegt = await createCommission({
        no: nr,
        client: kunde,
        project: doc.projekt,
        owner: ctx.employee?.initials ?? undefined,
      });
      treffer = await findKommission(angelegt.no);
    }

    const sauber: ProtokollDoc = {
      ...doc,
      commissionId: treffer?.id ?? null,
      kommissionNr: nr,
      kunde,
      status: "bereit",
      version: 1,
      parentId: null,
      mitarbeiterId: ctx.employee?.id ?? null,
      mitarbeiterName: ctx.employee?.name ?? "",
      maengel: [],
      fotos: [],
      unterschriften: [],
      abgeschlossenAt: null,
      pdfPath: null,
      rev: 0,
    };
    await insertProtokoll(sauber);
    revalidatePath("/abnahme");
    return { ok: true, data: { id: sauber.id } };
  } catch (e) {
    console.error("Abnahme anlegen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler." };
  }
}

/** Versand aus der Ablage am PC (das PDF liegt bereits im Storage). */
export async function sendeAction(typ: "abnahme" | "regie", id: string, an: string, kopie: string): Promise<AbnahmeResult> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const r = await versendeDokument({ typ, id, an, kopie, ausgeloestVon: ctx.employee?.id ?? null });
    revalidatePath(typ === "abnahme" ? `/abnahme/protokoll/${id}` : `/abnahme/regie/ansicht/${id}`);
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Versand fehlgeschlagen." };
  }
}

/**
 * Offene Mängel als erledigt markieren = Nachtrag: neue Version des Protokolls (die alte bleibt erhalten).
 * Der Nachtrag wird danach auf dem Tablet geladen, unterschrieben und abgeschlossen.
 */
export async function legeNachtragAn(id: string, erledigteMangelIds: string[]): Promise<AbnahmeResult<{ id: string }>> {
  try {
    await requireAppAccess("abnahme");
    const alt = await ladeProtokollDoc(id);
    if (!alt) return { ok: false, error: "Protokoll nicht gefunden." };
    if (alt.status !== "abgeschlossen") return { ok: false, error: "Nur abgeschlossene Protokolle erhalten einen Nachtrag." };
    if (erledigteMangelIds.length === 0) return { ok: false, error: "Bitte mindestens einen Mangel als erledigt wählen." };
    const supabase = await createClient();
    const kind = await supabase.from("abnahme_protokolle").select("id").eq("parent_id", id).neq("status", "abgeschlossen").maybeSingle();
    if (kind.data) return { ok: false, error: "Es gibt bereits einen offenen Nachtrag zu diesem Protokoll." };
    const neu = erzeugeNachtrag(alt, erledigteMangelIds, crypto.randomUUID());
    await insertProtokoll({ ...neu, mitarbeiterId: alt.mitarbeiterId });
    revalidatePath("/abnahme");
    return { ok: true, data: { id: neu.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nachtrag fehlgeschlagen." };
  }
}

/** CEO/Admin: Checkout eines Geräts aufheben (z. B. Tablet verloren). */
export async function gibGeraetFrei(typ: "abnahme" | "regie", id: string): Promise<AbnahmeResult> {
  try {
    await requireAppAccess("abnahme");
    const supabase = await createClient();
    const r = await supabase.rpc("abnahme_release", { p_typ: typ, p_id: id, p_device: "", p_force: true });
    if (r.error) return { ok: false, error: r.error.message };
    revalidatePath(typ === "abnahme" ? `/abnahme/protokoll/${id}` : `/abnahme/regie/ansicht/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nicht möglich." };
  }
}
