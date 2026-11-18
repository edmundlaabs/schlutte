"use client";

import { useMemo } from "react";
import { addDays, monatsName, wochentag } from "@/lib/urlaub/datum";
import { feiertagName } from "@/lib/urlaub/feiertage";
import type { Betriebsferien, Sperre } from "@/lib/urlaub/types";
import type { EigenerEintrag, KollegenEintrag } from "./JahresKalender";

const TAGE_BEZ = [1, 5, 10, 15, 20, 25, 30];

/**
 * Gesamtübersicht des Jahres auf einen Blick: 12 Zeilen (Monate) × 31 Spalten (Tage).
 * Obere Zellhälfte = Kollegen (je mehr, desto kräftiger), untere Hälfte = eigene Abwesenheit.
 * Hintergrund: Wochenende/Feiertag grau, Betriebsferien getönt, Urlaubssperre schraffiert.
 */
export function UebersichtRaster({
  jahr,
  heute,
  eigene,
  kollegen,
  zeigeKollegen,
  ferien,
  sperren,
  onMonat,
}: {
  jahr: number;
  heute: string;
  eigene: EigenerEintrag[];
  kollegen: KollegenEintrag[];
  zeigeKollegen: boolean;
  ferien: Betriebsferien[];
  sperren: Sperre[];
  onMonat: (monat0: number) => void;
}) {
  const { eigenTag, kollegenTag } = useMemo(() => {
    const von = `${jahr}-01-01`;
    const bis = `${jahr}-12-31`;
    const eigenTag = new Map<string, "genehmigt" | "beantragt">();
    const kollegenTag = new Map<string, string[]>();
    const tage = (a: string, b: string, f: (d: string) => void) => {
      for (let d = a < von ? von : a, ende = b > bis ? bis : b; d <= ende; d = addDays(d, 1)) f(d);
    };
    for (const e of eigene) {
      if (!["beantragt", "genehmigt", "storno_beantragt"].includes(e.status)) continue;
      const s = e.status === "beantragt" ? "beantragt" : "genehmigt";
      tage(e.von, e.bis, (d) => { if (eigenTag.get(d) !== "genehmigt") eigenTag.set(d, s); });
    }
    for (const k of kollegen) tage(k.von, k.bis, (d) => kollegenTag.set(d, [...(kollegenTag.get(d) ?? []), k.name]));
    return { eigenTag, kollegenTag };
  }, [jahr, eigene, kollegen]);

  return (
    <div className="urlaub-uebersicht" role="table" aria-label={`Jahresübersicht ${jahr}`}>
      <div className="urlaub-ub-zeile urlaub-ub-kopf" role="row">
        <span className="urlaub-ub-monat" />
        {Array.from({ length: 31 }, (_, i) => (
          <span key={i} className="urlaub-ub-tag">{TAGE_BEZ.includes(i + 1) ? i + 1 : ""}</span>
        ))}
      </div>
      {Array.from({ length: 12 }, (_, m) => {
        const tageImMonat = new Date(Date.UTC(jahr, m + 1, 0)).getUTCDate();
        return (
          <div key={m} className="urlaub-ub-zeile" role="row">
            <button type="button" className="urlaub-ub-monat" onClick={() => onMonat(m)} title={`${monatsName(m)} im Detail`}>
              {monatsName(m).slice(0, 3)}
            </button>
            {Array.from({ length: 31 }, (_, i) => {
              if (i >= tageImMonat) return <span key={i} className="urlaub-ub-zelle is-leer" />;
              const d = `${jahr}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
              const feiertag = feiertagName(d);
              const we = wochentag(d) >= 5;
              const ferienTag = ferien.find((f) => f.von <= d && d <= f.bis);
              const sperreTag = sperren.find((s) => s.von <= d && d <= s.bis);
              const eigen = eigenTag.get(d);
              const namen = zeigeKollegen ? kollegenTag.get(d) ?? [] : [];
              const stufe = Math.min(namen.length, 3);
              const klassen = [
                "urlaub-ub-zelle",
                (we || feiertag) && "is-grau",
                ferienTag && "is-ferien",
                sperreTag && "is-sperre",
                d === heute && "is-heute",
                eigen && `is-eigen-${eigen}`,
                stufe > 0 && `is-kollegen-${stufe}`,
              ].filter(Boolean).join(" ");
              const titel = [
                `${i + 1}.${m + 1}.${jahr}`,
                feiertag,
                ferienTag && `Betriebsferien: ${ferienTag.titel}`,
                sperreTag && `Urlaubssperre: ${sperreTag.titel}`,
                eigen && `Ich: ${eigen === "genehmigt" ? "abwesend" : "beantragt"}`,
                namen.length > 0 && `Abwesend: ${namen.join(", ")}`,
              ].filter(Boolean).join(" · ");
              return <button key={i} type="button" className={klassen} title={titel} aria-label={titel} onClick={() => onMonat(m)} />;
            })}
          </div>
        );
      })}
    </div>
  );
}
