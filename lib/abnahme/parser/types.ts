/** Ein Textstück einer PDF-Seite. y = Grundlinie, von oben gemessen (pt). */
export type TextItem = { str: string; x: number; y: number; bold: boolean };

export type PdfPage = { height: number; items: TextItem[] };

export type PositionTyp = "raum" | "abnahme" | "ausgeblendet";

export type ParsedPosition = {
  /** Laufende Nummer in der Datei (eindeutig, Profacto-Nr kann doppelt sein). */
  index: number;
  nr: string;
  menge: string | null;
  einheit: string | null;
  artikel: string | null;
  titel: string;
  langtext: string;
  typ: PositionTyp;
  /** Titel des zuletzt davor stehenden Raums (null = vor dem ersten Raum). */
  raum: string | null;
  /** Grund für „ausgeblendet“. */
  grund?: "artikel" | "mehrpreis" | "minderpreis" | "krankosten";
};

export type ParsedList = {
  kommissionNr: string;
  projekt: string;
  kunde: string;
  positionen: ParsedPosition[];
  warnings: string[];
};
