import { holeDokument, speichereDokument } from "./db";

/**
 * Führt vorgemerkte Mails aus (nur nach erfolgreichem Sync, damit das PDF am Server liegt).
 * Erfolgreiche Einträge werden entfernt; alles andere bleibt vorgemerkt und wird beim nächsten Sync erneut versucht.
 */
export async function fuehreVersandAus(docId: string): Promise<{ gesendet: number; fehler: string }> {
  const e = await holeDokument(docId);
  if (!e || e.versand.length === 0) return { gesendet: 0, fehler: "" };
  if (e.doc.status !== "abgeschlossen") return { gesendet: 0, fehler: "" };
  const uebrig: typeof e.versand = [];
  let gesendet = 0;
  let fehler = "";
  for (const v of e.versand) {
    try {
      const res = await fetch("/api/abnahme/versand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ: e.typ, id: docId, an: v.an, kopie: v.kopie, schluessel: v.schluessel }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        gesendet++;
        continue;
      }
      fehler = json.error ?? `Fehler ${res.status}`;
    } catch {
      fehler = "Keine Verbindung.";
    }
    uebrig.push(v);
  }
  const cur = await holeDokument(docId);
  if (cur) {
    // Nur Vormerkungen entfernen, die wirklich gesendet wurden; neu hinzugekommene bleiben.
    const bleibt = cur.versand.filter((v) => uebrig.some((u) => u.schluessel === v.schluessel) || !e.versand.some((x) => x.schluessel === v.schluessel));
    await speichereDokument({ ...cur, versand: bleibt });
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("abnahme-sync"));
  return { gesendet, fehler };
}
