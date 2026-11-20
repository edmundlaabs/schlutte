import type { ParsedList, ParsedPosition, PdfPage, TextItem } from "./types.ts";

/**
 * Parser für die Profacto-„Einfache Positionsliste“ (textbasiertes PDF, feste Spalten).
 * Regeln nach docs/PLAN_ABNAHME.md Abschnitt 4. Arbeitet auf bereits extrahierten Textstücken
 * (siehe pdf-text.ts), damit er ohne Browser und ohne pdfjs testbar ist.
 */

/** Alles darüber (Grundlinie) gehört zum Seitenkopf: Adresse, „Einfache Positionsliste“, Seite, Datum. */
const HEADER_MAX_Y = 95;
/** Alles weiter als so viele pt über dem Seitenende wird als Fußbereich ignoriert. */
const FOOTER_MARGIN = 30;
/** Zeilentoleranz: Items mit höchstens so viel Abstand in y gehören zur selben Zeile. */
const ROW_TOLERANCE = 3;

const X_NR_MAX = 80;
const X_PROJEKT_MIN = 80;
const X_KUNDE_MIN = 260;
const X_MENGE_MAX = 130;
const X_EINHEIT_MIN = 130;
const X_EINHEIT_MAX = 172;

type Row = { y: number; items: TextItem[] };

function groupRows(page: PdfPage): Row[] {
  const items = page.items
    .filter((it) => it.str.trim() !== "" && it.y >= HEADER_MAX_Y && it.y <= page.height - FOOTER_MARGIN)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Row[] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(it.y - row.y) <= ROW_TOLERANCE) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

const joined = (items: TextItem[]) => items.map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim();

function isPositionRow(row: Row): boolean {
  const first = row.items[0];
  return first.x < X_NR_MAX && /^\d{1,3}$/.test(first.str.trim());
}

type Draft = {
  nr: string;
  menge: string | null;
  einheit: string | null;
  artikel: string[];
  titel: string[];
  text: string[];
};

function startPosition(row: Row): Draft {
  const [nrItem, ...rest] = row.items;
  const d: Draft = { nr: nrItem.str.trim(), menge: null, einheit: null, artikel: [], titel: [], text: [] };
  let seenSlash = false;
  for (const it of rest) {
    const s = it.str.trim();
    if (d.menge === null && it.x < X_MENGE_MAX && /^[\d.,]+$/.test(s)) {
      d.menge = s;
    } else if (d.einheit === null && !seenSlash && it.x >= X_EINHEIT_MIN && it.x < X_EINHEIT_MAX && !it.bold) {
      d.einheit = s;
    } else if (it.bold) {
      d.titel.push(s);
    } else if (s.endsWith("/")) {
      seenSlash = true;
      const art = s.slice(0, -1).trim();
      if (art) d.artikel.push(art);
    } else if (seenSlash) {
      d.titel.push(s);
    } else {
      d.artikel.push(s);
    }
  }
  return d;
}

function classify(d: Draft): Pick<ParsedPosition, "typ" | "grund"> {
  const titel = d.titel.join(" ");
  const artikel = d.artikel.join(" ");
  if (d.menge === null && titel && !/krankosten/i.test(titel)) return { typ: "raum" };
  if (artikel.startsWith("Z_")) return { typ: "ausgeblendet", grund: "artikel" };
  if (/^mehrpreis/i.test(titel)) return { typ: "ausgeblendet", grund: "mehrpreis" };
  if (/^minderpreis/i.test(titel)) return { typ: "ausgeblendet", grund: "minderpreis" };
  if (/krankosten/i.test(titel)) return { typ: "ausgeblendet", grund: "krankosten" };
  return { typ: "abnahme" };
}

export function parseProfactoPages(pages: PdfPage[]): ParsedList {
  const warnings: string[] = [];
  const head = { nr: "", projekt: [] as string[], kunde: [] as string[] };
  const drafts: Draft[] = [];
  let cur: Draft | null = null;

  pages.forEach((page, pageIndex) => {
    for (const row of groupRows(page)) {
      if (isPositionRow(row)) {
        cur = startPosition(row);
        drafts.push(cur);
        continue;
      }
      if (!cur) {
        // Kopf der Liste (nur vor der ersten Position): Kommission | Projekt | Kunde.
        if (pageIndex === 0) {
          const nr = row.items.find((i) => i.x < X_NR_MAX && /^\d{6}$/.test(i.str.trim()));
          if (nr && !head.nr) head.nr = nr.str.trim();
          const p = joined(row.items.filter((i) => i.x >= X_PROJEKT_MIN && i.x < X_KUNDE_MIN));
          const k = joined(row.items.filter((i) => i.x >= X_KUNDE_MIN));
          if (p) head.projekt.push(p);
          if (k) head.kunde.push(k);
        }
        continue;
      }
      // Folgezeile: fette Zeile direkt nach dem Titel = Titelfortsetzung, sonst Langtext.
      if (row.items.every((i) => i.bold) && cur.text.length === 0) {
        cur.titel.push(joined(row.items));
      } else {
        cur.text.push(joined(row.items));
      }
    }
  });

  let raum: string | null = null;
  const positionen: ParsedPosition[] = drafts.map((d, index) => {
    const lines = [...d.text];
    let titel = d.titel.join(" ").replace(/\s*\/\s*$/, "").trim();
    if (!titel && lines.length) titel = lines.shift()!;
    const { typ, grund } = classify({ ...d, titel: [titel] });
    const pos: ParsedPosition = {
      index,
      nr: d.nr,
      menge: d.menge,
      einheit: d.einheit,
      artikel: d.artikel.length ? d.artikel.join(" ") : null,
      titel,
      langtext: lines.join("\n").trim(),
      typ,
      raum: typ === "raum" ? null : raum,
      ...(grund ? { grund } : {}),
    };
    if (typ === "raum") raum = titel;
    return pos;
  });

  const kommissionNr = head.nr;
  if (!kommissionNr) warnings.push("Kommissionsnummer im Kopf nicht gefunden.");
  const kunde = head.kunde.join(" ").trim();
  if (!kunde) warnings.push("Kunde im Kopf nicht gefunden.");
  if (!positionen.length) warnings.push("Keine Positionen erkannt – ist das wirklich eine Profacto-Positionsliste?");

  const seen = new Map<string, number>();
  for (const p of positionen) seen.set(p.nr, (seen.get(p.nr) ?? 0) + 1);
  for (const [nr, n] of seen) if (n > 1) warnings.push(`Positionsnummer ${nr} kommt ${n}× vor.`);
  if (positionen.some((p) => p.typ === "abnahme" && p.raum === null)) {
    warnings.push("Abnahmerelevante Positionen stehen vor der ersten Raum-Überschrift und landen im Raum „Allgemein“.");
  }

  return {
    kommissionNr,
    projekt: head.projekt.join(" ").trim(),
    kunde,
    positionen,
    warnings,
  };
}
