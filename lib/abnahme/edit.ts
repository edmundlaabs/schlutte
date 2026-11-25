import type { Position, ProtokollDoc, Pruefpunkt, Raum } from "./types.ts";

/**
 * Reine Bearbeitungsfunktionen für Räume, Positionen und Prüfpunkte beim Anlegen eines Protokolls
 * (Import und manueller Editor). Keine Mängel/Fotos – die gibt es erst in der Begehung (logic.ts).
 */

export const EINHEITEN = ["Stk", "lfm", "m²", "pausch"] as const;

const neueId = () => crypto.randomUUID();
const nummeriert = <T extends { sort: number }>(liste: T[]): T[] => liste.map((x, i) => ({ ...x, sort: i }));

export function neuerRaum(doc: ProtokollDoc, name = "Neuer Raum", daten: Partial<Raum> = {}): { doc: ProtokollDoc; raum: Raum } {
  const raum: Raum = { id: neueId(), sort: doc.raeume.length, name, etage: "", materialText: "", bemerkung: "", ...daten };
  return { doc: { ...doc, raeume: [...doc.raeume, raum] }, raum };
}

export function aendereRaum(doc: ProtokollDoc, id: string, patch: Partial<Raum>): ProtokollDoc {
  return { ...doc, raeume: doc.raeume.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

/** Löscht einen Raum. `positionen: "entfernen"` löscht seine Positionen mit, `"loesen"` lässt sie ohne Raum zurück. */
export function loescheRaum(doc: ProtokollDoc, id: string, positionen: "entfernen" | "loesen"): ProtokollDoc {
  return {
    ...doc,
    raeume: nummeriert(doc.raeume.filter((r) => r.id !== id)),
    positionen:
      positionen === "entfernen"
        ? nummeriert(doc.positionen.filter((p) => p.raumId !== id))
        : doc.positionen.map((p) => (p.raumId === id ? { ...p, raumId: null } : p)),
  };
}

export function verschiebeRaum(doc: ProtokollDoc, id: string, richtung: -1 | 1): ProtokollDoc {
  const i = doc.raeume.findIndex((r) => r.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= doc.raeume.length) return doc;
  const liste = [...doc.raeume];
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return { ...doc, raeume: nummeriert(liste) };
}

/** Nächste laufende Positionsnummer: höchste rein numerische Nr + 1 (sonst Anzahl + 1). */
export function naechsteNr(doc: Pick<ProtokollDoc, "positionen">): string {
  const nums = doc.positionen.map((p) => (/^\d+$/.test(p.nr.trim()) ? Number(p.nr.trim()) : 0));
  return String(Math.max(0, ...nums) + 1);
}

export type PositionEingabe = {
  titel: string;
  menge?: string;
  einheit?: string;
  langtext?: string;
  nr?: string;
  vorlageId?: string | null;
  pruefpunkte?: { de: string; en?: string }[];
};

export function baueDokumentPruefpunkte(punkte: { de: string; en?: string }[] = []): Pruefpunkt[] {
  return punkte
    .filter((k) => k.de.trim())
    .map((k, i) => ({ id: neueId(), sort: i, textDe: k.de.trim(), textEn: (k.en ?? "").trim() || k.de.trim(), status: "offen" as const, bemerkung: "" }));
}

export function neuePosition(doc: ProtokollDoc, raumId: string, e: PositionEingabe): { doc: ProtokollDoc; position: Position } {
  const titel = e.titel.trim();
  if (!titel) throw new Error("Bitte einen Titel eingeben.");
  if (!doc.raeume.some((r) => r.id === raumId)) throw new Error("Raum nicht gefunden.");
  const position: Position = {
    id: neueId(),
    raumId,
    sort: doc.positionen.reduce((n, p) => Math.max(n, p.sort), -1) + 1,
    nr: (e.nr ?? "").trim() || naechsteNr(doc),
    menge: (e.menge ?? "").trim(),
    einheit: (e.einheit ?? "").trim(),
    artikel: "",
    titel,
    langtext: (e.langtext ?? "").trim(),
    relevant: true,
    vorlageId: e.vorlageId ?? null,
    status: "offen",
    bemerkung: "",
    pruefpunkte: baueDokumentPruefpunkte(e.pruefpunkte),
  };
  return { doc: { ...doc, positionen: [...doc.positionen, position] }, position };
}

export function aenderePosition(doc: ProtokollDoc, id: string, patch: Partial<Position>): ProtokollDoc {
  return { ...doc, positionen: doc.positionen.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function loeschePosition(doc: ProtokollDoc, id: string): ProtokollDoc {
  return { ...doc, positionen: nummeriert(doc.positionen.filter((p) => p.id !== id)) };
}

export function verschiebePositionen(doc: ProtokollDoc, ids: ReadonlySet<string>, raumId: string): ProtokollDoc {
  if (!doc.raeume.some((r) => r.id === raumId)) return doc;
  return { ...doc, positionen: doc.positionen.map((p) => (ids.has(p.id) ? { ...p, raumId } : p)) };
}

export function aenderePruefpunkt(doc: ProtokollDoc, positionId: string, pruefpunktId: string, patch: Partial<Pruefpunkt>): ProtokollDoc {
  return {
    ...doc,
    positionen: doc.positionen.map((p) =>
      p.id === positionId ? { ...p, pruefpunkte: p.pruefpunkte.map((k) => (k.id === pruefpunktId ? { ...k, ...patch } : k)) } : p
    ),
  };
}

export function loeschePruefpunktEntwurf(doc: ProtokollDoc, positionId: string, pruefpunktId: string): ProtokollDoc {
  return {
    ...doc,
    positionen: doc.positionen.map((p) =>
      p.id === positionId ? { ...p, pruefpunkte: nummeriert(p.pruefpunkte.filter((k) => k.id !== pruefpunktId)) } : p
    ),
  };
}

/** Leeres Protokoll für den manuellen Editor. */
export function leeresProtokoll(base: Pick<ProtokollDoc, "id" | "mitarbeiterId" | "mitarbeiterName">): ProtokollDoc {
  return {
    commissionId: null, kommissionNr: "", kunde: "", projekt: "", titel: "", ort: "", sprache: "de",
    status: "bereit", quelle: "manuell", version: 1, parentId: null, teilnehmer: [], kundeEmail: "", kopieEmail: "",
    bemerkung: "", beginnAt: null, abgeschlossenAt: null, originalPath: null, pdfPath: null, rev: 0,
    raeume: [], positionen: [], maengel: [], fotos: [], unterschriften: [],
    ...base,
  };
}
