import type { Position, Pruefpunkt, Vorlage } from "./types.ts";

const KEYWORDS: [RegExp, string][] = [
  [/garderobe|ankleide/i, "Garderobe"],
  [/handlauf/i, "Handlauf"],
  [/regal/i, "Regal"],
  [/schrank|schränke|schraenke/i, "Schrank"],
];

/** Schlägt anhand des Titels einen Möbeltyp vor. Ohne Treffer: keine Vorlage (Position nur als Ganzes abnehmen). */
export function suggestVorlage(titel: string, vorlagen: readonly Vorlage[]): Vorlage | null {
  for (const [re, typ] of KEYWORDS) {
    if (re.test(titel)) return vorlagen.find((v) => v.aktiv && v.moebeltyp === typ) ?? null;
  }
  return null;
}

/** Prüfpunkte einer Vorlage (neue IDs, Status offen). */
export function pruefpunkteAusVorlage(vorlage: Vorlage | null): Pruefpunkt[] {
  if (!vorlage) return [];
  return vorlage.punkte.map((p, i) => ({
    id: crypto.randomUUID(),
    sort: i,
    textDe: p.de,
    textEn: p.en,
    status: "offen",
    bemerkung: "",
  }));
}

export function setzeVorlage(pos: Position, vorlage: Vorlage | null): Position {
  return { ...pos, vorlageId: vorlage?.id ?? null, pruefpunkte: pruefpunkteAusVorlage(vorlage) };
}
