import { addDays } from "./datum.ts";

/** Ostersonntag (Gregorianischer Kalender, Meeus/Jones/Butcher) als ISO-Tag. */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

const cache = new Map<number, Map<string, string>>();

/** Gesetzliche Feiertage Baden-Württemberg eines Jahres: ISO-Tag → Name. */
export function feiertageBW(jahr: number): Map<string, string> {
  const hit = cache.get(jahr);
  if (hit) return hit;
  const ostern = ostersonntag(jahr);
  const m = new Map<string, string>([
    [`${jahr}-01-01`, "Neujahr"],
    [`${jahr}-01-06`, "Heilige Drei Könige"],
    [addDays(ostern, -2), "Karfreitag"],
    [addDays(ostern, 1), "Ostermontag"],
    [`${jahr}-05-01`, "Tag der Arbeit"],
    [addDays(ostern, 39), "Christi Himmelfahrt"],
    [addDays(ostern, 50), "Pfingstmontag"],
    [addDays(ostern, 60), "Fronleichnam"],
    [`${jahr}-10-03`, "Tag der Deutschen Einheit"],
    [`${jahr}-11-01`, "Allerheiligen"],
    [`${jahr}-12-25`, "1. Weihnachtstag"],
    [`${jahr}-12-26`, "2. Weihnachtstag"],
  ]);
  cache.set(jahr, m);
  return m;
}

export function feiertagName(iso: string): string | null {
  return feiertageBW(Number(iso.slice(0, 4))).get(iso) ?? null;
}

/** 24.12. und 31.12. zählen (wenn Arbeitstag) nur als halber Tag. */
export function istHalberFeiertag(iso: string): boolean {
  return iso.endsWith("-12-24") || iso.endsWith("-12-31");
}
