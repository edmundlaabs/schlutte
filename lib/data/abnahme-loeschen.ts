import { createAdminClient } from "@/lib/supabase/admin";

export type KettenEintrag = { id: string; status: string; version: number };

/**
 * Das Protokoll und alle seine Nachträge (parent_id-Kette abwärts), Eltern vor Kindern.
 * Läuft mit dem Service-Role-Client: Löschen abgeschlossener Protokolle sperrt der Trigger für normale Nutzer;
 * die Berechtigung prüft die aufrufende Server Action.
 */
export async function ermittleKette(id: string): Promise<KettenEintrag[]> {
  const admin = createAdminClient();
  const start = await admin.from("abnahme_protokolle").select("id,status,version").eq("id", id).maybeSingle();
  if (!start.data) return [];
  const kette: KettenEintrag[] = [start.data as KettenEintrag];
  let front = [id];
  while (front.length) {
    const r = await admin.from("abnahme_protokolle").select("id,status,version").in("parent_id", front);
    front = [];
    for (const k of (r.data ?? []) as KettenEintrag[]) {
      kette.push(k);
      front.push(k.id);
    }
  }
  return kette;
}

/**
 * Löscht Protokoll + Nachträge samt Räumen, Positionen, Mängeln, Unterschriften, Versandprotokoll und Dateien
 * (Original-PDF, Fotos, Unterschriften, PDF). Dateien, die noch von verbleibenden Protokollen genutzt werden
 * (ein Nachtrag verweist auf Bilder der Vorversion), bleiben erhalten.
 */
export async function loescheKette(kette: KettenEintrag[]): Promise<{ geloescht: number; dateien: number }> {
  const admin = createAdminClient();
  const ids = kette.map((k) => k.id);
  const pfade = new Set<string>();
  const [p, f, of, u] = await Promise.all([
    admin.from("abnahme_protokolle").select("original_path,pdf_path").in("id", ids),
    admin.from("abnahme_fotos").select("path").in("protokoll_id", ids),
    admin.from("abnahme_objektfotos").select("path").in("protokoll_id", ids),
    admin.from("abnahme_unterschriften").select("bild_path").in("protokoll_id", ids),
  ]);
  for (const r of p.data ?? []) for (const x of [r.original_path, r.pdf_path]) if (x) pfade.add(x as string);
  for (const r of f.data ?? []) if (r.path) pfade.add(r.path as string);
  for (const r of of.data ?? []) if (r.path) pfade.add(r.path as string);
  for (const r of u.data ?? []) if (r.bild_path) pfade.add(r.bild_path as string);

  // Kinder zuerst (parent_id ist „restrict“).
  for (const pid of [...ids].reverse()) {
    await admin.from("abnahme_versand").delete().eq("dokument_typ", "abnahme").eq("dokument_id", pid);
    const d = await admin.from("abnahme_protokolle").delete().eq("id", pid);
    if (d.error) throw new Error(`Protokoll konnte nicht gelöscht werden: ${d.error.message}`);
  }

  let dateien = 0;
  if (pfade.size) {
    const liste = Array.from(pfade);
    const [rf, rof, ru, rp1, rp2] = await Promise.all([
      admin.from("abnahme_fotos").select("path").in("path", liste),
      admin.from("abnahme_objektfotos").select("path").in("path", liste),
      admin.from("abnahme_unterschriften").select("bild_path").in("bild_path", liste),
      admin.from("abnahme_protokolle").select("original_path").in("original_path", liste),
      admin.from("abnahme_protokolle").select("pdf_path").in("pdf_path", liste),
    ]);
    const noch = new Set<string>([
      ...(rf.data ?? []).map((r) => r.path as string),
      ...(rof.data ?? []).map((r) => r.path as string),
      ...(ru.data ?? []).map((r) => r.bild_path as string),
      ...(rp1.data ?? []).map((r) => r.original_path as string),
      ...(rp2.data ?? []).map((r) => r.pdf_path as string),
    ]);
    const weg = liste.filter((x) => !noch.has(x));
    if (weg.length) {
      const r = await admin.storage.from("abnahme").remove(weg);
      if (!r.error) dateien = weg.length;
    }
  }
  return { geloescht: ids.length, dateien };
}

/**
 * Löscht einen Regiebericht samt Zeilen (Cascade), Versandprotokoll, archivierten Ständen (Cascade) und Dateien
 * (Kundenunterschrift, PDF). Service-Role-Client wegen der Sperre abgeschlossener Berichte für normale Nutzer;
 * die Berechtigung prüft die aufrufende Server Action.
 */
export async function loescheRegiebericht(id: string): Promise<{ dateien: number }> {
  const admin = createAdminClient();
  const r = await admin.from("abnahme_regieberichte").select("id,unterschrift_path,pdf_path").eq("id", id).maybeSingle();
  if (!r.data) throw new Error("Regiebericht nicht gefunden.");
  const pfade = [r.data.unterschrift_path, r.data.pdf_path].filter((x): x is string => Boolean(x));
  await admin.from("abnahme_versand").delete().eq("dokument_typ", "regie").eq("dokument_id", id);
  const d = await admin.from("abnahme_regieberichte").delete().eq("id", id);
  if (d.error) throw new Error(`Regiebericht konnte nicht gelöscht werden: ${d.error.message}`);
  let dateien = 0;
  if (pfade.length) {
    const rm = await admin.storage.from("abnahme").remove(pfade);
    if (!rm.error) dateien = pfade.length;
  }
  return { dateien };
}
