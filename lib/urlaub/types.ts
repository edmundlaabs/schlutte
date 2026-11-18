/**
 * Typen des Moduls Urlaub. Reine Typen/Konstanten — keine Server-Abhängigkeiten,
 * damit auch die rein rechnenden Module (und ihre Tests) sie nutzen können.
 * Alle Datumswerte sind ISO-Tage "JJJJ-MM-TT".
 */

export type Antragsart = "urlaub" | "ueberstunden" | "sonder" | "krank";

export type Antragsstatus =
  | "beantragt"
  | "genehmigt"
  | "abgelehnt"
  | "zurueckgezogen"
  | "storno_beantragt"
  | "storniert";

export const ART_LABEL: Record<Antragsart, string> = {
  urlaub: "Urlaub",
  ueberstunden: "Überstundenabbau",
  sonder: "Sonderurlaub",
  krank: "Krankmeldung",
};

export const STATUS_LABEL: Record<Antragsstatus, string> = {
  beantragt: "Beantragt",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
  zurueckgezogen: "Zurückgezogen",
  storno_beantragt: "Storno beantragt",
  storniert: "Storniert",
};

/** Status, in denen ein Antrag „aktiv“ ist (blockiert Zeitraum für Konfliktprüfung). */
export const AKTIVE_STATUS: readonly Antragsstatus[] = ["beantragt", "genehmigt", "storno_beantragt"];

/** Status, in denen die Abwesenheit als genehmigt gilt (zählt zum Konto). */
export const GENEHMIGTE_STATUS: readonly Antragsstatus[] = ["genehmigt", "storno_beantragt"];

export type Arbeitsmuster = {
  mo: boolean;
  di: boolean;
  mi: boolean;
  do: boolean;
  fr: boolean;
  sa: boolean;
  so: boolean;
};

/** Muster ab einem Stichtag; fehlt ein Eintrag, gilt Mo–Fr. */
export type ArbeitsmusterEintrag = Arbeitsmuster & { gueltig_ab: string };

export const STANDARD_MUSTER: Arbeitsmuster = {
  mo: true, di: true, mi: true, do: true, fr: true, sa: false, so: false,
};

export type Betriebsferien = {
  id: string;
  von: string;
  bis: string;
  titel: string;
  zaehlt_als_urlaub: boolean;
};

export type Sperre = { id: string; von: string; bis: string; titel: string };

export type Konfliktpaar = { id: string; employee_a: string; employee_b: string };

export type Kontingent = {
  employee_id: string;
  jahr: number;
  anspruch: number;
  uebertrag: number;
  uebertrag_verfall: string;
  korrektur: number;
  korrektur_notiz: string | null;
};

export type Antrag = {
  id: string;
  employee_id: string;
  art: Antragsart;
  von: string;
  bis: string;
  halbtag_start: boolean;
  halbtag_ende: boolean;
  tage: number;
  status: Antragsstatus;
  kommentar: string | null;
  entschieden_von: string | null;
  entschieden_am: string | null;
  begruendung: string | null;
  created_at: string;
  updated_at: string;
};

export type ProtokollEintrag = {
  id: string;
  antrag_id: string;
  aktion: string;
  von_employee: string | null;
  notiz: string | null;
  created_at: string;
};
