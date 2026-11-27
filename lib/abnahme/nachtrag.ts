import type { ProtokollDoc } from "./types.ts";
import { positionStatus } from "./logic.ts";

/**
 * Nachtrag = neue Version des Protokolls. Alles wird mit neuen IDs kopiert (die alte Version bleibt
 * unverändert), ausgewählte Mängel werden als erledigt markiert und ihre Positionen/Prüfpunkte auf „i. O.“
 * gesetzt. Unterschriften werden nicht übernommen: Der Nachtrag wird erneut unterschrieben und abgeschlossen.
 */
export function erzeugeNachtrag(alt: ProtokollDoc, erledigteMangelIds: string[], neueId: string, jetzt = new Date().toISOString()): ProtokollDoc {
  const erledigt = new Set(erledigteMangelIds);
  const raumMap = new Map(alt.raeume.map((r) => [r.id, crypto.randomUUID()]));
  const posMap = new Map(alt.positionen.map((p) => [p.id, crypto.randomUUID()]));
  const pruefMap = new Map(alt.positionen.flatMap((p) => p.pruefpunkte.map((k) => [k.id, crypto.randomUUID()] as const)));
  const mangelMap = new Map(alt.maengel.map((m) => [m.id, crypto.randomUUID()]));

  const erledigteRefs = new Set(alt.maengel.filter((m) => erledigt.has(m.id)).map((m) => `${m.positionId}|${m.pruefpunktId}`));

  const positionen = alt.positionen.map((p) => {
    const np = {
      ...p,
      id: posMap.get(p.id)!,
      raumId: p.raumId ? raumMap.get(p.raumId) ?? null : null,
      pruefpunkte: p.pruefpunkte.map((k) => ({
        ...k,
        id: pruefMap.get(k.id)!,
        status: erledigteRefs.has(`${p.id}|${k.id}`) ? ("io" as const) : k.status,
      })),
      status: erledigteRefs.has(`${p.id}|null`) ? ("io" as const) : p.status,
    };
    return { ...np, status: positionStatus(np) };
  });

  return {
    ...alt,
    id: neueId,
    version: alt.version + 1,
    parentId: alt.id,
    status: "bereit",
    abgeschlossenAt: null,
    beginnAt: null,
    pdfPath: null,
    // Jede Version bekommt einen eigenen Link; er entsteht beim Abschluss der neuen Version.
    publicToken: null,
    publicAktiv: true,
    publicErstelltAt: null,
    originalPath: alt.originalPath,
    rev: 0,
    bemerkung: "",
    raeume: alt.raeume.map((r) => ({ ...r, id: raumMap.get(r.id)! })),
    positionen,
    maengel: alt.maengel.map((m) => ({
      ...m,
      id: mangelMap.get(m.id)!,
      raumId: m.raumId ? raumMap.get(m.raumId) ?? null : null,
      positionId: m.positionId ? posMap.get(m.positionId) ?? null : null,
      pruefpunktId: m.pruefpunktId ? pruefMap.get(m.pruefpunktId) ?? null : null,
      erledigtAt: erledigt.has(m.id) ? jetzt : m.erledigtAt,
    })),
    objektFotos: (alt.objektFotos ?? []).map((f) => ({ ...f, id: crypto.randomUUID(), positionId: posMap.get(f.positionId)! })),
    fotos: alt.fotos.map((f) => ({ ...f, id: crypto.randomUUID(), mangelId: mangelMap.get(f.mangelId)! })),
    unterschriften: [],
  };
}
