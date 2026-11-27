/**
 * Gemeinsames Dokumentmodell für Abnahmeprotokoll und Regiebericht.
 * Dieselbe Struktur liegt in IndexedDB (offline), wird für das PDF gelesen und beim Sync
 * in die abnahme_*-Tabellen abgebildet (lib/abnahme/mapping.ts).
 * Alle IDs sind clientseitig erzeugte UUIDs.
 */

export type Sprache = "de" | "en";
export type PruefStatus = "offen" | "io" | "mangel" | "nicht_pruefbar";
export type ProtokollStatus = "entwurf" | "bereit" | "in_arbeit" | "abgeschlossen";
/** Herkunft eines Protokolls: Profacto-Import, von Hand angelegt oder aus einer Protokoll-Vorlage. */
export type Quelle = "profacto" | "manuell" | "vorlage";
export type Bezug = "raum" | "position" | "schluss_kunde" | "schluss_mitarbeiter";

export type Teilnehmer = { name: string; rolle?: string; employeeId?: string };

export type Raum = {
  id: string;
  sort: number;
  name: string;
  etage: string;
  materialText: string;
  bemerkung: string;
};

export type Pruefpunkt = {
  id: string;
  sort: number;
  textDe: string;
  textEn: string;
  status: PruefStatus;
  bemerkung: string;
};

export type Position = {
  id: string;
  raumId: string | null;
  sort: number;
  nr: string;
  menge: string;
  einheit: string;
  artikel: string;
  titel: string;
  langtext: string;
  relevant: boolean;
  vorlageId: string | null;
  status: PruefStatus;
  bemerkung: string;
  pruefpunkte: Pruefpunkt[];
};

export type Mangel = {
  id: string;
  raumId: string | null;
  positionId: string | null;
  pruefpunktId: string | null;
  sort: number;
  text: string;
  frist: string; // JJJJ-MM-TT oder ""
  erledigtAt: string | null;
};

export type Foto = {
  id: string;
  mangelId: string;
  /** Storage-Pfad, sobald hochgeladen. Der Blob liegt bis dahin in IndexedDB. */
  path: string | null;
  breite: number;
  hoehe: number;
  aufgenommenAt: string;
};

/** Foto des Objekts (Position), auch bei „i. O.“ – nicht an einen Mangel gebunden. */
export type ObjektFoto = {
  id: string;
  positionId: string;
  /** Storage-Pfad, sobald hochgeladen. Der Blob liegt bis dahin in IndexedDB. */
  path: string | null;
  breite: number;
  hoehe: number;
  aufgenommenAt: string;
};

export type Unterschrift = {
  id: string;
  bezug: Bezug;
  bezugId: string | null;
  name: string;
  rolle: string;
  bildPath: string | null;
  zeitpunkt: string;
};

export type ProtokollDoc = {
  id: string;
  commissionId: string | null;
  /** Leer = ohne Kommission (Kleinauftrag); in der Datenbank NULL. */
  kommissionNr: string;
  kunde: string;
  projekt: string;
  titel: string;
  ort: string;
  sprache: Sprache;
  status: ProtokollStatus;
  quelle: Quelle;
  version: number;
  parentId: string | null;
  mitarbeiterId: string | null;
  mitarbeiterName: string;
  teilnehmer: Teilnehmer[];
  kundeEmail: string;
  kopieEmail: string;
  bemerkung: string;
  beginnAt: string | null;
  abgeschlossenAt: string | null;
  originalPath: string | null;
  pdfPath: string | null;
  /** Öffentlicher Link (/p/<token>); entsteht beim Abschluss auf dem Gerät. Fehlt bei älteren Dokumenten. */
  publicToken?: string | null;
  publicAktiv?: boolean;
  publicErstelltAt?: string | null;
  rev: number;
  raeume: Raum[];
  positionen: Position[];
  maengel: Mangel[];
  fotos: Foto[];
  /** Objektfotos je Position; fehlt bei Dokumenten, die vor Version 1.5 angelegt wurden. */
  objektFotos?: ObjektFoto[];
  unterschriften: Unterschrift[];
};

export type Vorlage = {
  id: string;
  moebeltyp: string;
  titelDe: string;
  titelEn: string;
  punkte: { de: string; en: string }[];
  aktiv: boolean;
  sort: number;
};

/** Position einer Protokoll-Vorlage. Prüfpunkte = Möbeltyp-Vorlage (falls vorlageId) plus eigene. */
export type VorlagePosition = {
  titel: string;
  einheit: string;
  beschreibung: string;
  vorlageId: string | null;
  pruefpunkte: { de: string; en: string }[];
};

export type VorlageRaum = {
  name: string;
  etage: string;
  materialText: string;
  positionen: VorlagePosition[];
};

export type ProtokollVorlage = {
  id: string;
  titelDe: string;
  titelEn: string;
  beschreibung: string;
  raeume: VorlageRaum[];
  aktiv: boolean;
  sort: number;
};

/** Eine Regiebericht-Zeile. Stunden je Rolle in 0,5er-Schritten. */
export type RegieZeile = {
  id: string;
  pos: number;
  datum: string;
  text: string;
  menge: string;
  laenge: string;
  breite: string;
  staerke: string;
  km: number | null;
  stdMeister: number;
  stdMonteur: number;
  stdLehrling: number;
  stdHelfer: number;
};

export type RegieDoc = {
  id: string;
  commissionId: string | null;
  kommissionNr: string;
  kunde: string;
  name: string;
  strasse: string;
  ort: string;
  telefon: string;
  datum: string;
  beschreibung: string;
  sprache: Sprache;
  status: "entwurf" | "abgeschlossen";
  mitarbeiterId: string | null;
  mitarbeiterName: string;
  unterschriftPath: string | null;
  unterschriftName: string;
  anerkanntAt: string | null;
  kundeEmail: string;
  kopieEmail: string;
  pdfPath: string | null;
  rev: number;
  zeilen: RegieZeile[];
};
