/**
 * Datums-Helfer für ISO-Tage ("JJJJ-MM-TT"). Rechnet immer in UTC, damit
 * Sommer-/Winterzeit und Zeitzone des Servers keine Rolle spielen.
 */

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Wochentag: 0 = Montag … 6 = Sonntag. */
export function wochentag(iso: string): number {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}

export function jahrVon(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Alle Tage von..bis (einschließlich). Leer, wenn bis < von. */
export function eachDay(von: string, bis: string): string[] {
  const out: string[] = [];
  for (let d = von; d <= bis; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Überschneiden sich zwei Zeiträume (einschließlich der Grenztage)? */
export function ueberschneiden(a: { von: string; bis: string }, b: { von: string; bis: string }): boolean {
  return a.von <= b.bis && b.von <= a.bis;
}

export function heuteISO(now: Date = new Date()): string {
  // Lokales Datum (Server läuft ggf. in UTC): Berlin als Referenz.
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
  return f.format(now);
}

/** Gültiger ISO-Tag "JJJJ-MM-TT" (echtes Kalenderdatum)? */
export function istISO(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISO(parseISO(value)) === value;
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export function monatsName(monat0: number): string {
  return MONATE[monat0] ?? "";
}

/** Kurzes deutsches Datum "TT.MM." bzw. "TT.MM.JJJJ". */
export function datumKurz(iso: string, mitJahr = false): string {
  const [y, m, d] = iso.split("-");
  return mitJahr ? `${d}.${m}.${y}` : `${d}.${m}.`;
}

/** Zeitraum "10.08.–14.08.2026" bzw. "10.08.2026". */
export function zeitraumText(von: string, bis: string): string {
  if (von === bis) return datumKurz(von, true);
  return `${datumKurz(von, von.slice(0, 4) !== bis.slice(0, 4))}–${datumKurz(bis, true)}`;
}

/** Tage als "2,5" / "3". */
export function tageText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
