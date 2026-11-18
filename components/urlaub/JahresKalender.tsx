"use client";

import { useMemo, useState } from "react";
import { MonatsRaster, type RasterEintrag, type RasterZeile } from "./MonatsRaster";
import { monatsName, zeitraumText } from "@/lib/urlaub/datum";
import { ART_LABEL, STATUS_LABEL, type Antragsart, type Antragsstatus, type Betriebsferien, type Sperre } from "@/lib/urlaub/types";

export type EigenerEintrag = {
  von: string;
  bis: string;
  art: Antragsart;
  status: Antragsstatus;
  halbtag_start: boolean;
  halbtag_ende: boolean;
};

export type KollegenEintrag = {
  name: string;
  von: string;
  bis: string;
  halbtag_start: boolean;
  halbtag_ende: boolean;
  status: "beantragt" | "genehmigt";
};

/**
 * Jahreskalender für Mitarbeiter: 12 Monatsraster (ab Tablet alle untereinander), auf dem Handy ein
 * Monat mit Vor/Zurück. Filter „nur ich / alle“. Kollegen erscheinen nur als „abwesend“ mit Name.
 */
export function JahresKalender({
  jahr,
  heute,
  eigene,
  kollegen,
  ferien,
  sperren,
}: {
  jahr: number;
  heute: string;
  eigene: EigenerEintrag[];
  kollegen: KollegenEintrag[];
  ferien: Betriebsferien[];
  sperren: Sperre[];
}) {
  const [filter, setFilter] = useState<"alle" | "ich">("alle");
  const heuteMonat = Number(heute.slice(0, 4)) === jahr ? Number(heute.slice(5, 7)) - 1 : 0;
  const [monat, setMonat] = useState(heuteMonat);

  const zeilen = useMemo<RasterZeile[]>(() => {
    const out: RasterZeile[] = [];
    const sichtbar = eigene.filter((e) => ["beantragt", "genehmigt", "storno_beantragt"].includes(e.status));
    if (filter === "alle") {
      if (ferien.length) {
        out.push({
          key: "ferien",
          label: "Betriebsferien",
          eintraege: ferien.map((f): RasterEintrag => ({ von: f.von, bis: f.bis, typ: "ferien", label: f.titel, titel: `Betriebsferien: ${f.titel}${f.zaehlt_als_urlaub ? " (zählt als Urlaub)" : ""}` })),
        });
      }
      if (sperren.length) {
        out.push({
          key: "sperren",
          label: "Urlaubssperre",
          eintraege: sperren.map((s): RasterEintrag => ({ von: s.von, bis: s.bis, typ: "sperre", label: s.titel, titel: `Urlaubssperre: ${s.titel}` })),
        });
      }
    }
    out.push({
      key: "ich",
      label: "Ich",
      eintraege: sichtbar.map((e): RasterEintrag => ({
        von: e.von,
        bis: e.bis,
        typ: "eigen",
        status: e.status === "beantragt" ? "beantragt" : "genehmigt",
        halbStart: e.halbtag_start,
        halbEnde: e.halbtag_ende,
        label: e.art === "urlaub" ? "" : ART_LABEL[e.art],
        titel: `${ART_LABEL[e.art]} · ${zeitraumText(e.von, e.bis)} · ${STATUS_LABEL[e.status]}`,
      })),
    });
    if (filter === "alle") {
      const nachName = new Map<string, RasterEintrag[]>();
      for (const k of kollegen) {
        const liste = nachName.get(k.name) ?? [];
        liste.push({
          von: k.von,
          bis: k.bis,
          typ: "kollege",
          status: k.status,
          halbStart: k.halbtag_start,
          halbEnde: k.halbtag_ende,
          titel: `${k.name} · abwesend · ${zeitraumText(k.von, k.bis)}${k.status === "beantragt" ? " (beantragt)" : ""}`,
        });
        nachName.set(k.name, liste);
      }
      for (const [name, eintraege] of [...nachName].sort((a, b) => a[0].localeCompare(b[0], "de"))) {
        out.push({ key: `k-${name}`, label: name, eintraege });
      }
    }
    return out;
  }, [filter, eigene, kollegen, ferien, sperren]);

  return (
    <div>
      <div className="urlaub-steuerung">
        <div className="aus-filters" aria-label="Anzeige">
          <button type="button" className={`aus-filter${filter === "alle" ? " is-active" : ""}`} onClick={() => setFilter("alle")}>Alle</button>
          <button type="button" className={`aus-filter${filter === "ich" ? " is-active" : ""}`} onClick={() => setFilter("ich")}>Nur ich</button>
        </div>
        <div className="urlaub-monatswahl nur-mobil">
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setMonat((m) => (m + 11) % 12)} aria-label="Vorheriger Monat">‹</button>
          <strong>{monatsName(monat)}</strong>
          <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" onClick={() => setMonat((m) => (m + 1) % 12)} aria-label="Nächster Monat">›</button>
        </div>
      </div>

      <ul className="urlaub-legende" aria-label="Legende">
        <li><i /> Genehmigt</li>
        <li><i className="l-beantragt" /> Beantragt</li>
        {filter === "alle" && <li><i className="l-kollege" /> Kollegen (abwesend)</li>}
        <li><i className="l-ferien" /> Betriebsferien</li>
        <li><i className="l-sperre" /> Urlaubssperre</li>
      </ul>

      <div className="urlaub-jahr">
        {Array.from({ length: 12 }, (_, m) => (
          <section key={m} className={`urlaub-monat${m === monat ? " is-aktuell" : ""}`} aria-label={`${monatsName(m)} ${jahr}`}>
            <h3 className="urlaub-monat-titel">{monatsName(m)} <span className="aus-subtle">{jahr}</span></h3>
            <MonatsRaster jahr={jahr} monat={m} zeilen={zeilen} ferien={ferien} sperren={sperren} heute={heute} />
          </section>
        ))}
      </div>
    </div>
  );
}
