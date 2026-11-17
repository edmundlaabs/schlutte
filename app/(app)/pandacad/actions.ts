"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Kurzlebige Signed URL (60 s) für eine Datei aus der Download-Liste.
 * Prüft has_app_access('pandacad') serverseitig; zusätzlich greift die
 * Storage-RLS, weil mit der Sitzung des Nutzers (nicht Service-Role) signiert wird.
 */
export async function getPandaCadDownloadUrl(
  downloadId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();

  const { data: allowed, error: accessError } = await supabase.rpc("has_app_access", {
    app: "pandacad",
  });
  if (accessError || allowed !== true) return { error: "Kein Zugriff auf PandaCAD." };

  const { data: row } = await supabase
    .from("pandacad_downloads")
    .select("storage_path, titel")
    .eq("id", downloadId)
    .maybeSingle();
  if (!row) return { error: "Datei nicht gefunden." };

  const { data, error } = await supabase.storage
    .from("pandacad")
    .createSignedUrl(row.storage_path, 60, { download: true });
  if (error || !data?.signedUrl) {
    return { error: "Download-Link konnte nicht erstellt werden." };
  }
  return { url: data.signedUrl };
}
