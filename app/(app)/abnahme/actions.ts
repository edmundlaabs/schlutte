"use server";

import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createCommission } from "@/lib/data/commissions";
import { findKommission, insertProtokoll, type KommissionTreffer } from "@/lib/data/abnahme";
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
