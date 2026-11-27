import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ladeProtokollDocMit } from "@/lib/data/abnahme";
import { istPublicToken } from "@/lib/abnahme/public-token";
import { baueModell, sammlePfade, type PublicModell } from "@/lib/abnahme/public-view";
import { abnahmeDateiname } from "@/lib/abnahme/filename";
import { DEMO_TOKEN, demoModell } from "@/lib/abnahme/public-fixture";

/**
 * Öffentlicher Zugriff auf ein abgeschlossenes Protokoll – ausschließlich über den Token (Service-Role, nur serverseitig).
 * Unbekannt, deaktiviert oder nicht abgeschlossen → null (die Seite zeigt immer dieselbe neutrale 404).
 */
async function finde(token: string) {
  if (!istPublicToken(token)) return null;
  const admin = createAdminClient();
  const r = await admin
    .from("abnahme_protokolle")
    .select("id,pdf_path,kommission_nr,kunde,abgeschlossen_at,created_at")
    .eq("public_token", token)
    .eq("public_aktiv", true)
    .eq("status", "abgeschlossen")
    .maybeSingle();
  if (r.error || !r.data) return null;
  return { admin, protokoll: r.data };
}

const STUNDE = 3600;

export async function ladePublicProtokoll(token: string): Promise<PublicModell | null> {
  // Nur lokal (next dev): Demo-Fixture zum Prüfen von Layout und Lightbox, ohne Datenbankzugriff. Im Produktivbuild wirkungslos.
  if (process.env.NODE_ENV === "development" && token === DEMO_TOKEN) return demoModell();
  const f = await finde(token);
  if (!f) return null;
  const doc = await ladeProtokollDocMit(f.admin as never, f.protokoll.id);
  if (!doc) return null;
  const paths = sammlePfade(doc);
  const signed: Record<string, string> = {};
  if (paths.length) {
    // Bei jedem Seitenaufruf neu signiert (1 h); der Bucket bleibt privat.
    const res = await f.admin.storage.from("abnahme").createSignedUrls(paths, STUNDE);
    for (const e of res.data ?? []) if (e.path && e.signedUrl) signed[e.path] = e.signedUrl;
  }
  return baueModell(doc, signed, Boolean(f.protokoll.pdf_path));
}

/** Signierte Download-URL des PDFs (mit Dateinamen), oder null. */
export async function publicPdfUrl(token: string): Promise<string | null> {
  const f = await finde(token);
  if (!f?.protokoll.pdf_path) return null;
  const datum = String(f.protokoll.abgeschlossen_at ?? f.protokoll.created_at).slice(0, 10);
  const name = abnahmeDateiname(f.protokoll.kommission_nr, f.protokoll.kunde, datum);
  const res = await f.admin.storage.from("abnahme").createSignedUrl(f.protokoll.pdf_path, 300, { download: name });
  return res.data?.signedUrl ?? null;
}
