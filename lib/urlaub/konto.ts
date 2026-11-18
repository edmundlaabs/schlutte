import { tageProTag } from "./tage.ts";
import {
  GENEHMIGTE_STATUS,
  type Antrag,
  type ArbeitsmusterEintrag,
  type Betriebsferien,
  type Kontingent,
} from "./types.ts";

export type KontoInput = {
  jahr: number;
  /** Fehlt der Eintrag, gilt alles als 0. */
  kontingent: Pick<Kontingent, "anspruch" | "uebertrag" | "uebertrag_verfall" | "korrektur"> | null;
  /** Anträge dieses Mitarbeiters (alle Arten/Stati; relevant sind nur Art „urlaub“). */
  antraege: readonly Pick<Antrag, "art" | "von" | "bis" | "halbtag_start" | "halbtag_ende" | "status">[];
  muster: readonly ArbeitsmusterEintrag[];
  /** Alle Betriebsferien (mit und ohne Abzug). */
  betriebsferien: readonly Betriebsferien[];
  /** Stichtag „heute“ als ISO-Tag. */
  heute: string;
};

export type Konto = {
  jahr: number;
  anspruch: number;
  /** Übertrag laut Konto (vor Verfall). */
  uebertrag: number;
  uebertragVerfall: string;
  /** Davon bereits verbraucht (durch Urlaub bis zum Verfallsdatum). */
  uebertragGenutzt: number;
  /** Verfallener Übertrag (erst nach dem Verfallsdatum > 0). */
  uebertragVerfallen: number;
  korrektur: number;
  genommen: number;
  geplant: number;
  beantragt: number;
  /** Anspruch + Übertrag (ohne Verfallenes) + Korrektur − genommen − geplant. */
  rest: number;
  /** Rest, falls alle offenen Anträge genehmigt würden. */
  restNachBeantragt: number;
};

const RANG_GENEHMIGT = 2;
const RANG_BEANTRAGT = 1;

type TagEintrag = { wert: number; rang: number };

/** Tageswerte des Jahres, die gegen das Konto zählen (je Tag höchster Status, größter Wert, keine Doppelzählung). */
function kontoTage(input: KontoInput): Map<string, TagEintrag> {
  const { jahr } = input;
  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  const tage = new Map<string, TagEintrag>();

  const merke = (datum: string, wert: number, rang: number) => {
    if (wert <= 0 || datum < von || datum > bis) return;
    const alt = tage.get(datum);
    if (!alt || rang > alt.rang || (rang === alt.rang && wert > alt.wert)) tage.set(datum, { wert, rang });
  };

  for (const a of input.antraege) {
    if (a.art !== "urlaub") continue;
    const rang = GENEHMIGTE_STATUS.includes(a.status) ? RANG_GENEHMIGT : a.status === "beantragt" ? RANG_BEANTRAGT : 0;
    if (!rang) continue;
    for (const t of tageProTag({
      von: a.von,
      bis: a.bis,
      halbtagStart: a.halbtag_start,
      halbtagEnde: a.halbtag_ende,
      muster: input.muster,
      betriebsferien: input.betriebsferien,
    })) merke(t.datum, t.wert, rang);
  }

  // Betriebsferien mit Abzug: automatische Buchung, wie ein genehmigter Urlaub.
  for (const b of input.betriebsferien) {
    if (!b.zaehlt_als_urlaub) continue;
    for (const t of tageProTag({ von: b.von, bis: b.bis, muster: input.muster })) {
      merke(t.datum, t.wert, RANG_GENEHMIGT);
    }
  }
  return tage;
}

export function berechneKonto(input: KontoInput): Konto {
  const k = input.kontingent;
  const anspruch = k?.anspruch ?? 0;
  const uebertrag = Math.max(0, k?.uebertrag ?? 0);
  const korrektur = k?.korrektur ?? 0;
  const verfall = k?.uebertrag_verfall ?? `${input.jahr}-03-31`;

  let genommen = 0;
  let geplant = 0;
  let beantragt = 0;
  let genehmigtBisVerfall = 0;
  for (const [datum, t] of kontoTage(input)) {
    if (t.rang === RANG_BEANTRAGT) { beantragt += t.wert; continue; }
    if (datum <= input.heute) genommen += t.wert; else geplant += t.wert;
    if (datum <= verfall) genehmigtBisVerfall += t.wert;
  }

  // Urlaub bis zum Verfallsdatum geht zuerst vom Übertrag ab; der Rest des Übertrags verfällt.
  const uebertragGenutzt = Math.min(uebertrag, genehmigtBisVerfall);
  const uebertragVerfallen = input.heute > verfall ? uebertrag - uebertragGenutzt : 0;

  const rest = anspruch + uebertrag - uebertragVerfallen + korrektur - genommen - geplant;
  return {
    jahr: input.jahr,
    anspruch,
    uebertrag,
    uebertragVerfall: verfall,
    uebertragGenutzt,
    uebertragVerfallen,
    korrektur,
    genommen,
    geplant,
    beantragt,
    rest,
    restNachBeantragt: rest - beantragt,
  };
}

/** Vorschlag für den Übertrag ins Folgejahr: Rest des Vorjahres zum 31.12. (nie negativ). */
export function uebertragVorschlag(vorjahr: Omit<KontoInput, "heute">): number {
  const konto = berechneKonto({ ...vorjahr, heute: `${vorjahr.jahr}-12-31` });
  return Math.max(0, konto.rest);
}

/**
 * Rest, falls ein Antrag so entschieden würde wie angegeben (für den Eingang):
 * „genehmigt“ zählt den Antrag mit, „storniert“ nimmt ihn heraus. Andere offene Anträge bleiben außen vor.
 */
export function restNachEntscheidung(
  input: Omit<KontoInput, "antraege"> & { antraege: readonly (KontoInput["antraege"][number] & { id: string })[] },
  antragId: string,
  entscheidung: "genehmigt" | "storniert",
): number {
  const antraege = input.antraege
    .filter((a) => a.id === antragId || GENEHMIGTE_STATUS.includes(a.status))
    .map((a) => (a.id === antragId ? { ...a, status: entscheidung } : a));
  return berechneKonto({ ...input, antraege }).rest;
}
