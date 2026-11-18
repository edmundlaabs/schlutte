import Link from "next/link";
import { addDays, eachDay, monatsName, wochentag } from "@/lib/urlaub/datum";
import { feiertagName } from "@/lib/urlaub/feiertage";
import type { Betriebsferien, Sperre } from "@/lib/urlaub/types";

export type RasterEintrag = {
  von: string;
  bis: string;
  typ: "eigen" | "kollege" | "ferien" | "sperre";
  status?: "genehmigt" | "beantragt";
  halbStart?: boolean;
  halbEnde?: boolean;
  /** Rot hinterlegt (Konflikt, nur Admin-Ansicht). */
  konflikt?: boolean;
  label?: string;
  titel?: string;
  href?: string;
};

export type RasterZeile = { key: string; label: string; eintraege: RasterEintrag[] };

const WOCHENTAG = ["M", "D", "M", "D", "F", "S", "S"];

/**
 * Ein Monat als Raster: Zeilen = Personen (oder Betriebsferien/Sperren), Spalten = Tage.
 * Wochenenden/Feiertage grau, Betriebsferien und Sperren hinterlegt. Rein darstellend.
 */
export function MonatsRaster({
  jahr,
  monat,
  zeilen,
  ferien,
  sperren,
  heute,
  leerText = "Keine Abwesenheiten in diesem Monat.",
}: {
  jahr: number;
  /** 0 = Januar … 11 = Dezember. */
  monat: number;
  zeilen: RasterZeile[];
  ferien: readonly Betriebsferien[];
  sperren: readonly Sperre[];
  heute: string;
  leerText?: string;
}) {
  const erster = `${jahr}-${String(monat + 1).padStart(2, "0")}-01`;
  const naechster = monat === 11 ? `${jahr + 1}-01-01` : `${jahr}-${String(monat + 2).padStart(2, "0")}-01`;
  const letzter = addDays(naechster, -1);
  const tage = eachDay(erster, letzter);
  const n = tage.length;

  const spalten = tage.map((d) => {
    const feiertag = feiertagName(d);
    const we = wochentag(d) >= 5;
    return {
      d,
      feiertag,
      we,
      ferien: ferien.some((f) => f.von <= d && d <= f.bis),
      sperre: sperren.some((s) => s.von <= d && d <= s.bis),
    };
  });
  const zellKlassen = (s: (typeof spalten)[number]) =>
    ["urlaub-zelle", s.we && "is-we", s.feiertag && "is-feiertag", s.ferien && "is-ferien", s.sperre && "is-sperre", s.d === heute && "is-heute"]
      .filter(Boolean)
      .join(" ");

  const zeilenMitInhalt = zeilen.filter((z) => z.eintraege.some((e) => e.von <= letzter && e.bis >= erster));

  return (
    <div className="urlaub-raster-wrap">
      <div className="urlaub-raster" style={{ ["--tage" as string]: n }} role="table" aria-label={`${monatsName(monat)} ${jahr}`}>
        <div className="urlaub-rzeile urlaub-kopf" role="row">
          <div className="urlaub-rname" role="columnheader">{monatsName(monat).slice(0, 3)}</div>
          {spalten.map((s, i) => (
            <div key={s.d} className={zellKlassen(s)} style={{ gridColumn: i + 2 }} title={s.feiertag ?? undefined} role="columnheader">
              <b>{Number(s.d.slice(8))}</b>
              {WOCHENTAG[wochentag(s.d)]}
            </div>
          ))}
        </div>

        {zeilenMitInhalt.length === 0 && <div className="urlaub-leer">{leerText}</div>}

        {zeilenMitInhalt.map((z) => (
          <div key={z.key} className="urlaub-rzeile" role="row">
            <div className="urlaub-rname" role="rowheader" title={z.label}>{z.label}</div>
            {spalten.map((s, i) => (
              <div key={s.d} className={zellKlassen(s)} style={{ gridColumn: i + 2 }} aria-hidden="true" />
            ))}
            {z.eintraege
              .filter((e) => e.von <= letzter && e.bis >= erster)
              .map((e, idx) => {
                const s = e.von < erster ? erster : e.von;
                const t = e.bis > letzter ? letzter : e.bis;
                const start = tage.indexOf(s);
                const ende = tage.indexOf(t);
                const breite = ende - start + 1;
                const klassen = [
                  "urlaub-balken",
                  e.typ === "kollege" && "is-kollege",
                  e.typ === "ferien" && "is-ferien",
                  e.typ === "sperre" && "is-sperre",
                  e.status === "beantragt" && "is-beantragt",
                  e.konflikt && "is-konflikt",
                  e.halbStart && e.von >= erster && "is-halb-start",
                  e.halbEnde && e.bis <= letzter && "is-halb-ende",
                ].filter(Boolean).join(" ");
                const stil = { gridColumn: `${start + 2} / ${ende + 3}`, ["--n" as string]: breite };
                const inhalt = e.label ?? "";
                return e.href ? (
                  <Link key={idx} href={e.href} className={klassen} style={stil} title={e.titel}>{inhalt}</Link>
                ) : (
                  <span key={idx} className={klassen} style={stil} title={e.titel}>{inhalt}</span>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
