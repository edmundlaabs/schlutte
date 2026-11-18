import { eachDay, wochentag } from "./datum.ts";
import { feiertagName, istHalberFeiertag } from "./feiertage.ts";
import {
  STANDARD_MUSTER,
  type Arbeitsmuster,
  type ArbeitsmusterEintrag,
  type Betriebsferien,
} from "./types.ts";

export type TagWert = {
  datum: string;
  /** 0, 0,5 oder 1. */
  wert: number;
  /** Warum 0 / 0,5 (für Hinweise im Formular). */
  grund?: "kein-arbeitstag" | "feiertag" | "betriebsferien" | "halber-feiertag" | "halbtag";
  feiertag?: string;
};

const SPALTE = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

/** Gültiges Arbeitsmuster an einem Tag: jüngster Eintrag mit gueltig_ab <= Tag, sonst Mo–Fr. */
export function musterFuerTag(muster: readonly ArbeitsmusterEintrag[], iso: string): Arbeitsmuster {
  let best: ArbeitsmusterEintrag | null = null;
  for (const m of muster) {
    if (m.gueltig_ab <= iso && (!best || m.gueltig_ab > best.gueltig_ab)) best = m;
  }
  return best ?? STANDARD_MUSTER;
}

export type TageInput = {
  von: string;
  bis: string;
  halbtagStart?: boolean;
  halbtagEnde?: boolean;
  /** Arbeitsmuster des Mitarbeiters (leer = Mo–Fr). */
  muster?: readonly ArbeitsmusterEintrag[];
  /** Betriebsferien, die NICHT als Urlaub zählen (zaehlt_als_urlaub = false): diese Tage zählen nicht. */
  betriebsferien?: readonly Betriebsferien[];
};

/**
 * Wert jedes Tages im Zeitraum. Regeln:
 *  - nur Arbeitstage laut Muster, keine Feiertage BW,
 *  - 24.12./31.12. zählen höchstens 0,5,
 *  - Betriebsferien mit zaehlt_als_urlaub = false zählen nicht,
 *  - halber Tag am Anfang/Ende → höchstens 0,5 (eintägig: ein Flag genügt).
 */
export function tageProTag(input: TageInput): TagWert[] {
  const { von, bis } = input;
  if (bis < von) return [];
  const frei = (input.betriebsferien ?? []).filter((b) => !b.zaehlt_als_urlaub);
  return eachDay(von, bis).map((datum): TagWert => {
    const muster = musterFuerTag(input.muster ?? [], datum);
    if (!muster[SPALTE[wochentag(datum)]]) return { datum, wert: 0, grund: "kein-arbeitstag" };
    const feiertag = feiertagName(datum);
    if (feiertag) return { datum, wert: 0, grund: "feiertag", feiertag };
    if (frei.some((b) => b.von <= datum && datum <= b.bis)) return { datum, wert: 0, grund: "betriebsferien" };

    let wert = 1;
    let grund: TagWert["grund"];
    if (istHalberFeiertag(datum)) { wert = 0.5; grund = "halber-feiertag"; }
    const halb = (datum === von && input.halbtagStart) || (datum === bis && input.halbtagEnde);
    if (halb) { wert = Math.min(wert, 0.5); grund = grund ?? "halbtag"; }
    return { datum, wert, grund };
  });
}

/** Summe der Arbeitstage eines Antrags (z. B. 2,5). */
export function berechneTage(input: TageInput): number {
  return tageProTag(input).reduce((s, t) => s + t.wert, 0);
}
