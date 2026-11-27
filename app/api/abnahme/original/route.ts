import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { abnahmeNutzer, jsonFehler } from "@/lib/abnahme/server-auth";

export const dynamic = "force-dynamic";

/**
 * Trägt den Pfad eines nachträglich hochgeladenen Originals ein. Die Foto-Tabellen sind nach dem Abschluss gesperrt
 * (Trigger); der Eintrag erfolgt daher hier per Service-Role, aber erst nach Prüfung von Zugang, Pfad und Datei.
 * Es wird ausschließlich `path_original` geändert.
 */
export async function POST(request: Request) {
  const ctx = await abnahmeNutzer();
  if (!ctx) return jsonFehler(401, "Nicht angemeldet oder kein Zugriff.");
  const b = (await request.json().catch(() => null)) as { protokollId?: string; fotoId?: string; art?: string; pfad?: string } | null;
  if (!b?.protokollId || !b.fotoId || !b.pfad || (b.art !== "foto" && b.art !== "objekt")) return jsonFehler(400, "Ungültige Anfrage.");
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID.test(b.protokollId) || !UUID.test(b.fotoId)) return jsonFehler(400, "Ungültige Anfrage.");
  // Der Pfad ist fest vorgegeben; nichts anderes darf eingetragen werden.
  if (b.pfad !== `protokoll/${b.protokollId}/fotos/${b.fotoId}.orig.jpg`) return jsonFehler(400, "Ungültiger Pfad.");

  // Zugriff über den Nutzer-Client (RLS): das Protokoll muss für ihn sichtbar sein.
  const supabase = await createClient();
  const p = await supabase.from("abnahme_protokolle").select("id").eq("id", b.protokollId).maybeSingle();
  if (p.error || !p.data) return jsonFehler(404, "Protokoll nicht gefunden.");

  const admin = createAdminClient();
  const ordner = `protokoll/${b.protokollId}/fotos`;
  const ls = await admin.storage.from("abnahme").list(ordner, { search: `${b.fotoId}.orig.jpg`, limit: 5 });
  if (ls.error || !ls.data?.some((f) => f.name === `${b.fotoId}.orig.jpg`)) return jsonFehler(409, "Das Original liegt noch nicht im Speicher.");

  const tabelle = b.art === "foto" ? "abnahme_fotos" : "abnahme_objektfotos";
  const u = await admin.from(tabelle).update({ path_original: b.pfad }).eq("id", b.fotoId).eq("protokoll_id", b.protokollId).select("id");
  if (u.error) return jsonFehler(500, u.error.message);
  // Das Foto ist (noch) nicht auf dem Server (Sync-Reihenfolge): nicht als Fehler werten, der Pfad kommt mit dem Sync.
  return Response.json({ ok: true, aktualisiert: (u.data?.length ?? 0) > 0 });
}
