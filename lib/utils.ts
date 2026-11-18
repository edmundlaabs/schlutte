/**
 * lib/utils.ts
 * Zentrale Hilfs-Utilities für Datumsformatierung und Begrüßungslogik.
 */

/**
 * Formatiert ein Datum als "TT.MM.JJJJ" (deutsches Format).
 * Akzeptiert ISO-Strings, Date-Objekte oder timestamptz-Strings aus Supabase.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Formatiert ein Datum als "TT.MM.JJJJ, HH:mm" (deutsches Format mit Uhrzeit).
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Gibt eine tageszeit-abhängige Begrüßung zurück.
 *   05:00 – 10:59 → "Guten Morgen, Name."
 *   11:00 – 17:59 → "Guten Tag, Name."
 *   18:00 – 04:59 → "Guten Abend, Name."
 *
 * @param name Anzeigename (kann leer sein → Fallback auf neutralen Text)
 */
export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  let salutation: string;
  if (hour >= 5 && hour < 11) {
    salutation = "Guten Morgen";
  } else if (hour >= 11 && hour < 18) {
    salutation = "Guten Tag";
  } else {
    salutation = "Guten Abend";
  }
  if (name && name.trim().length > 0) {
    return `${salutation}, ${name.trim()}.`;
  }
  return "Willkommen in Schlutte.";
}

/**
 * Vergleicht zwei Versionen "major.minor.patch". Fehlende/ungültige Teile zählen als 0.
 * Rückgabe: <0 wenn a < b, 0 wenn gleich, >0 wenn a > b. Null/leer ist kleiner als jede Version.
 */
export function compareSemver(a: string | null | undefined, b: string | null | undefined): number {
  const parse = (v: string | null | undefined): number[] | null => {
    if (!v || !/^\d+(\.\d+){0,2}$/.test(v.trim())) return null;
    const parts = v.trim().split(".").map(Number);
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}
