import type { RegieDoc, RegieZeile } from "./types.ts";

export const ROLLEN = ["Meister", "Monteur", "Lehrling", "Helfer"] as const;
export type Rolle = (typeof ROLLEN)[number];
type StdKey = "stdMeister" | "stdMonteur" | "stdLehrling" | "stdHelfer";
export const STD_KEYS: Record<Rolle, StdKey> = { Meister: "stdMeister", Monteur: "stdMonteur", Lehrling: "stdLehrling", Helfer: "stdHelfer" };

/** Auf 0,5er-Schritte runden, nie negativ. */
export function halbeStunden(wert: number): number {
  if (!Number.isFinite(wert) || wert < 0) return 0;
  return Math.round(wert * 2) / 2;
}

export function summen(zeilen: readonly RegieZeile[]): Record<Rolle, number> & { gesamt: number } {
  const s = { Meister: 0, Monteur: 0, Lehrling: 0, Helfer: 0, gesamt: 0 };
  for (const z of zeilen) {
    for (const r of ROLLEN) s[r] += z[STD_KEYS[r]];
  }
  s.gesamt = ROLLEN.reduce((n, r) => n + s[r], 0);
  return s;
}

export function neueZeile(doc: RegieDoc, heute: string): RegieZeile {
  const letzte = doc.zeilen[doc.zeilen.length - 1];
  return {
    id: crypto.randomUUID(), pos: doc.zeilen.length + 1, datum: letzte?.datum || heute, text: "", menge: "", laenge: "", breite: "",
    staerke: "", km: null, stdMeister: 0, stdMonteur: 0, stdLehrling: 0, stdHelfer: 0,
  };
}

/** Pos wird automatisch fortlaufend vergeben. */
export function nummeriere(zeilen: readonly RegieZeile[]): RegieZeile[] {
  return zeilen.map((z, i) => ({ ...z, pos: i + 1 }));
}

export function neuesRegieDoc(a: {
  kommissionNr: string; kunde: string; sprache: "de" | "en"; mitarbeiterId: string | null; mitarbeiterName: string; heute: string;
  vorbelegung?: Partial<Pick<RegieDoc, "name" | "strasse" | "ort" | "telefon" | "commissionId" | "kundeEmail">>;
}): RegieDoc {
  return {
    id: crypto.randomUUID(), commissionId: null, kommissionNr: a.kommissionNr.trim(), kunde: a.kunde.trim(),
    name: "", strasse: "", ort: "", telefon: "", datum: a.heute, beschreibung: "", sprache: a.sprache, status: "entwurf",
    mitarbeiterId: a.mitarbeiterId, mitarbeiterName: a.mitarbeiterName, unterschriftPath: null, unterschriftName: "",
    anerkanntAt: null, kundeEmail: "", kopieEmail: "", pdfPath: null, rev: 0, zeilen: [], ...a.vorbelegung,
  };
}

export function regieKannAbschliessen(doc: RegieDoc): { ok: boolean; gruende: string[] } {
  const gruende: string[] = [];
  if (!doc.kommissionNr.trim()) gruende.push("Kommissionsnummer fehlt");
  if (!doc.kunde.trim()) gruende.push("Kunde fehlt");
  if (doc.zeilen.length === 0) gruende.push("Keine Arbeiten erfasst");
  if (summen(doc.zeilen).gesamt <= 0) gruende.push("Keine Arbeitszeit erfasst");
  if (!doc.unterschriftName.trim()) gruende.push("Unterschrift Kunde fehlt");
  return { ok: gruende.length === 0, gruende };
}

/** Zeilen-Zeilen ⇄ DB */
type Row = Record<string, unknown>;
const nn = (s: string): string | null => (s.trim() === "" ? null : s);
const s = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

export function regieToRows(doc: RegieDoc): { regie: Row; zeilen: Row[] } {
  return {
    regie: {
      id: doc.id, commission_id: doc.commissionId, kommission_nr: doc.kommissionNr.trim(), kunde: doc.kunde.trim(),
      name: nn(doc.name), strasse: nn(doc.strasse), ort: nn(doc.ort), telefon: nn(doc.telefon), datum: doc.datum,
      beschreibung: nn(doc.beschreibung), sprache: doc.sprache, status: doc.status, mitarbeiter_id: doc.mitarbeiterId,
      mitarbeiter_name: nn(doc.mitarbeiterName), unterschrift_path: doc.unterschriftPath, unterschrift_name: nn(doc.unterschriftName),
      anerkannt_at: doc.anerkanntAt, kunde_email: nn(doc.kundeEmail), kopie_email: nn(doc.kopieEmail), pdf_path: doc.pdfPath,
    },
    zeilen: doc.zeilen.map((z) => ({
      id: z.id, regiebericht_id: doc.id, pos: z.pos, datum: nn(z.datum), text: nn(z.text), menge: nn(z.menge), laenge: nn(z.laenge),
      breite: nn(z.breite), staerke: nn(z.staerke), km: z.km, std_meister: halbeStunden(z.stdMeister), std_monteur: halbeStunden(z.stdMonteur),
      std_lehrling: halbeStunden(z.stdLehrling), std_helfer: halbeStunden(z.stdHelfer),
    })),
  };
}

export function rowsToRegie(row: Row, zeilen: Row[]): RegieDoc {
  return {
    id: s(row.id), commissionId: row.commission_id ? s(row.commission_id) : null, kommissionNr: s(row.kommission_nr), kunde: s(row.kunde),
    name: s(row.name), strasse: s(row.strasse), ort: s(row.ort), telefon: s(row.telefon), datum: s(row.datum).slice(0, 10),
    beschreibung: s(row.beschreibung), sprache: row.sprache === "en" ? "en" : "de", status: row.status === "abgeschlossen" ? "abgeschlossen" : "entwurf",
    mitarbeiterId: row.mitarbeiter_id ? s(row.mitarbeiter_id) : null, mitarbeiterName: s(row.mitarbeiter_name),
    unterschriftPath: row.unterschrift_path ? s(row.unterschrift_path) : null, unterschriftName: s(row.unterschrift_name),
    anerkanntAt: row.anerkannt_at ? s(row.anerkannt_at) : null, kundeEmail: s(row.kunde_email), kopieEmail: s(row.kopie_email),
    pdfPath: row.pdf_path ? s(row.pdf_path) : null, rev: Number(row.rev ?? 0),
    zeilen: zeilen
      .map((z) => ({
        id: s(z.id), pos: Number(z.pos ?? 0), datum: s(z.datum).slice(0, 10), text: s(z.text), menge: s(z.menge), laenge: s(z.laenge),
        breite: s(z.breite), staerke: s(z.staerke), km: z.km == null ? null : Number(z.km), stdMeister: Number(z.std_meister ?? 0),
        stdMonteur: Number(z.std_monteur ?? 0), stdLehrling: Number(z.std_lehrling ?? 0), stdHelfer: Number(z.std_helfer ?? 0),
      }))
      .sort((a, b) => a.pos - b.pos),
  };
}
