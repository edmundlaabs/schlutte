"use server";

import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/auth/app-access";
import { createCommission } from "@/lib/data/commissions";
import { findKommission, insertProtokoll, ladeProtokollDoc, searchKommissionen, type KommissionTreffer } from "@/lib/data/abnahme";
import { createClient } from "@/lib/supabase/server";
import { getActiveEmployees } from "@/lib/data/employees";
import { ermittleKette, loescheKette, loescheRegiebericht } from "@/lib/data/abnahme-loeschen";
import { versendeDokument } from "@/lib/abnahme/versand-server";
import { erzeugeNachtrag } from "@/lib/abnahme/nachtrag";
import type { ProtokollDoc, Quelle } from "@/lib/abnahme/types";
import type { KommissionModus, KundeKommission } from "@/lib/abnahme/kommission";
import { validiereNeuesProtokoll } from "@/lib/abnahme/validate";
import { zuQuelle } from "@/lib/abnahme/mapping";

export type AbnahmeResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function findeKommissionAction(nr: string): Promise<KommissionTreffer | null> {
  await requireAppAccess("abnahme");
  return findKommission(nr);
}

/** Durchführender Mitarbeiter: der im Protokoll gewählte (muss ein aktiver Mitarbeiter sein), sonst der angemeldete. */
async function waehleMitarbeiter(
  doc: Pick<ProtokollDoc, "mitarbeiterId">,
  ich: { id?: string | null; name?: string | null } | null | undefined
): Promise<{ mitarbeiterId: string | null; mitarbeiterName: string }> {
  if (doc.mitarbeiterId && doc.mitarbeiterId !== ich?.id) {
    const e = (await getActiveEmployees()).find((x) => x.id === doc.mitarbeiterId && x.is_active !== false);
    if (e) return { mitarbeiterId: e.id as string, mitarbeiterName: e.name };
  }
  return { mitarbeiterId: ich?.id ?? null, mitarbeiterName: ich?.name ?? "" };
}

export async function sucheKommissionenAction(q: string): Promise<KommissionTreffer[]> {
  await requireAppAccess("abnahme");
  try {
    return await searchKommissionen(q);
  } catch (e) {
    console.error("Kommissionssuche:", e);
    return [];
  }
}

/**
 * Legt ein Protokoll an (Profacto-Import, manuell oder aus Vorlage).
 * Kommission: „bestehend“ (wird serverseitig nachgeschlagen), „neu“ (wird hier angelegt, Nummer muss frei sein)
 * oder „ohne“ (Kleinauftrag, keine Zeile in commissions). Kundenname ist immer Pflicht.
 */
export async function legeProtokollAn(
  doc: ProtokollDoc,
  optionen: { kommission: KommissionModus; quelle: Quelle }
): Promise<AbnahmeResult<{ id: string }>> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const modus = optionen.kommission;
    const nr = modus === "ohne" ? "" : doc.kommissionNr.trim();
    const kunde = doc.kunde.trim();
    const kk: KundeKommission = { modus, commissionId: doc.commissionId, nr, kunde, projekt: doc.projekt };
    const probleme = validiereNeuesProtokoll(doc, kk);
    if (probleme.length) return { ok: false, error: probleme.join(" ") };

    let commissionId: string | null = null;
    if (modus === "bestehend") {
      const treffer = await findKommission(nr);
      if (!treffer) return { ok: false, error: `Kommission ${nr} existiert nicht (mehr). Bitte neu auswählen oder anlegen.` };
      commissionId = treffer.id;
    } else if (modus === "neu") {
      if (await findKommission(nr)) {
        return { ok: false, error: `Kommission ${nr} gibt es schon. Bitte aus der Suche auswählen.` };
      }
      const angelegt = await createCommission({
        no: nr,
        client: kunde,
        project: doc.projekt,
        owner: ctx.employee?.initials ?? undefined,
      });
      commissionId = (await findKommission(angelegt.no))?.id ?? null;
    }

    const sauber: ProtokollDoc = {
      ...doc,
      commissionId,
      kommissionNr: nr,
      kunde,
      quelle: zuQuelle(optionen.quelle),
      status: "bereit",
      version: 1,
      parentId: null,
      ...(await waehleMitarbeiter(doc, ctx.employee)),
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

/**
 * Einem Protokoll ohne Kommission nachträglich eine Kommission zuordnen (bestehend oder neu anlegen).
 * Nur online, nur solange das Protokoll nicht abgeschlossen ist. Die Version (rev) wird erhöht: Ein Tablet mit
 * älterem Stand sieht die Änderung beim nächsten Sync im Abgleich. Kunde und Projekt des Protokolls bleiben.
 */
export async function ordneKommissionZu(
  id: string,
  auswahl: { modus: "bestehend" | "neu"; nr: string }
): Promise<AbnahmeResult<{ nr: string }>> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const supabase = await createClient();
    const cur = await supabase
      .from("abnahme_protokolle")
      .select("id,status,kommission_nr,kunde,projekt,rev")
      .eq("id", id)
      .maybeSingle();
    if (cur.error || !cur.data) return { ok: false, error: "Protokoll nicht gefunden." };
    if (cur.data.status === "abgeschlossen") return { ok: false, error: "Abgeschlossene Protokolle lassen sich nicht mehr ändern. Nachtrag nutzen." };
    if (cur.data.kommission_nr) return { ok: false, error: "Das Protokoll hat bereits eine Kommission." };
    const nr = auswahl.nr.trim();
    if (!nr) return { ok: false, error: "Kommissionsnummer fehlt." };

    let commissionId: string | null = null;
    if (auswahl.modus === "bestehend") {
      const t = await findKommission(nr);
      if (!t) return { ok: false, error: `Kommission ${nr} existiert nicht.` };
      commissionId = t.id;
    } else {
      if (await findKommission(nr)) return { ok: false, error: `Kommission ${nr} gibt es schon. Bitte aus der Suche auswählen.` };
      const angelegt = await createCommission({
        no: nr,
        client: String(cur.data.kunde ?? ""),
        project: String(cur.data.projekt ?? ""),
        owner: ctx.employee?.initials ?? undefined,
      });
      commissionId = (await findKommission(angelegt.no))?.id ?? null;
    }
    const up = await supabase.from("abnahme_protokolle").update({ kommission_nr: nr, commission_id: commissionId, rev: Number(cur.data.rev ?? 0) + 1 }).eq("id", id);
    if (up.error) return { ok: false, error: up.error.message };
    revalidatePath(`/abnahme/protokoll/${id}`);
    revalidatePath("/abnahme");
    return { ok: true, data: { nr } };
  } catch (e) {
    console.error("Kommission zuordnen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Zuordnen fehlgeschlagen." };
  }
}

/** Durchführenden Mitarbeiter eines nicht abgeschlossenen Protokolls ändern (Detailseite, online). */
export async function aendereMitarbeiterAction(id: string, employeeId: string): Promise<AbnahmeResult<{ name: string }>> {
  try {
    await requireAppAccess("abnahme");
    const e = (await getActiveEmployees()).find((x) => x.id === employeeId && x.is_active !== false);
    if (!e) return { ok: false, error: "Mitarbeiter nicht gefunden." };
    const supabase = await createClient();
    const cur = await supabase.from("abnahme_protokolle").select("id,status,rev").eq("id", id).maybeSingle();
    if (cur.error || !cur.data) return { ok: false, error: "Protokoll nicht gefunden." };
    if (cur.data.status === "abgeschlossen") return { ok: false, error: "Abgeschlossene Protokolle lassen sich nicht mehr ändern. Nachtrag nutzen." };
    const up = await supabase
      .from("abnahme_protokolle")
      .update({ mitarbeiter_id: e.id, mitarbeiter_name: e.name, rev: Number(cur.data.rev ?? 0) + 1 })
      .eq("id", id);
    if (up.error) return { ok: false, error: up.error.message };
    revalidatePath(`/abnahme/protokoll/${id}`);
    return { ok: true, data: { name: e.name } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Ändern fehlgeschlagen." };
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

/**
 * Abnahmeprotokoll löschen (inkl. Nachträge, Original-PDF, Fotos, Unterschriften, PDF, Versandprotokoll).
 * Nicht abgeschlossene Protokolle (z. B. falscher Import) darf jeder mit Zugang löschen,
 * abgeschlossene (unterschriebene) nur CEO und Admin.
 */
export async function loescheProtokollAction(id: string): Promise<AbnahmeResult<{ geloescht: number }>> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const supabase = await createClient();
    const sichtbar = await supabase.from("abnahme_protokolle").select("id").eq("id", id).maybeSingle();
    if (!sichtbar.data) return { ok: false, error: "Protokoll nicht gefunden." };
    const kette = await ermittleKette(id);
    if (kette.length === 0) return { ok: false, error: "Protokoll nicht gefunden." };
    if (kette.some((k) => k.status === "abgeschlossen") && !ctx.isFinance) {
      return { ok: false, error: "Abgeschlossene (unterschriebene) Protokolle dürfen nur CEO und Administratoren löschen." };
    }
    const r = await loescheKette(kette);
    console.info(`Abnahme: ${r.geloescht} Protokoll(e) gelöscht (Start ${id}) von ${ctx.employee?.id ?? ctx.userId}`);
    revalidatePath("/abnahme");
    return { ok: true, data: { geloescht: r.geloescht } };
  } catch (e) {
    console.error("Abnahme löschen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Löschen fehlgeschlagen." };
  }
}

/**
 * Regiebericht löschen (inkl. Zeilen, Unterschrift, PDF, Versandprotokoll, archivierte Stände).
 * Nicht abgeschlossene Berichte darf jeder mit Zugang löschen, abgeschlossene nur CEO und Admin.
 */
export async function loescheRegieAction(id: string): Promise<AbnahmeResult> {
  try {
    const ctx = await requireAppAccess("abnahme");
    const supabase = await createClient();
    const r = await supabase.from("abnahme_regieberichte").select("id,status").eq("id", id).maybeSingle();
    if (!r.data) return { ok: false, error: "Regiebericht nicht gefunden." };
    if (r.data.status === "abgeschlossen" && !ctx.isFinance) {
      return { ok: false, error: "Abgeschlossene Regieberichte dürfen nur CEO und Administratoren löschen." };
    }
    await loescheRegiebericht(id);
    console.info(`Abnahme: Regiebericht ${id} gelöscht von ${ctx.employee?.id ?? ctx.userId}`);
    revalidatePath("/abnahme");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("Regiebericht löschen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Löschen fehlgeschlagen." };
  }
}
