import type { ParsedList } from "./parser/types.ts";
import type { ProtokollDoc, Position, Raum, Vorlage } from "./types.ts";
import { pruefpunkteAusVorlage, suggestVorlage } from "./vorlagen.ts";

export const OHNE_RAUM = "Allgemein";

/**
 * Baut aus dem Parser-Ergebnis ein Protokoll-Dokument (Entwurf für die Prüfansicht).
 * - Räume = Positionen ohne Menge, in Dateireihenfolge, Raum-Langtext = Materialangaben.
 * - Abnahmerelevante Positionen vor dem ersten Raum landen im Raum „Allgemein“.
 * - Ausgeblendete Positionen bleiben in ihrem Raum (relevant = false), einblendbar.
 */
export function buildDocFromParsed(
  parsed: ParsedList,
  vorlagen: readonly Vorlage[],
  base: Pick<ProtokollDoc, "id" | "mitarbeiterId" | "mitarbeiterName"> & Partial<ProtokollDoc>
): ProtokollDoc {
  const raeume: Raum[] = [];
  const raumByTitle = new Map<string, string>();
  const newRaum = (name: string, materialText = ""): Raum => {
    const r: Raum = { id: crypto.randomUUID(), sort: raeume.length, name, etage: "", materialText, bemerkung: "" };
    raeume.push(r);
    return r;
  };

  const needsGeneral = parsed.positionen.some((p) => p.typ === "abnahme" && p.raum === null);
  if (needsGeneral) {
    const r = newRaum(OHNE_RAUM);
    raumByTitle.set("\u0000", r.id);
  }
  // Räume in Reihenfolge (gleiche Titel bleiben getrennte Räume → Schlüssel = Index)
  const roomIdByIndex = new Map<number, string>();
  for (const p of parsed.positionen) {
    if (p.typ === "raum") roomIdByIndex.set(p.index, newRaum(p.titel, p.langtext).id);
  }
  // Raum eines Eintrags = letzter Raum davor
  let currentRoomId: string | null = needsGeneral ? raumByTitle.get("\u0000")! : null;
  const positionen: Position[] = [];
  for (const p of parsed.positionen) {
    if (p.typ === "raum") {
      currentRoomId = roomIdByIndex.get(p.index)!;
      continue;
    }
    const relevant = p.typ === "abnahme";
    const vorlage = relevant ? suggestVorlage(p.titel, vorlagen) : null;
    positionen.push({
      id: crypto.randomUUID(),
      raumId: currentRoomId,
      sort: positionen.length,
      nr: p.nr,
      menge: p.menge ?? "",
      einheit: p.einheit ?? "",
      artikel: p.artikel ?? "",
      titel: p.titel,
      langtext: p.langtext,
      relevant,
      vorlageId: vorlage?.id ?? null,
      status: "offen",
      bemerkung: "",
      pruefpunkte: pruefpunkteAusVorlage(vorlage),
    });
  }

  return {
    commissionId: null,
    kommissionNr: parsed.kommissionNr,
    kunde: parsed.kunde,
    projekt: parsed.projekt,
    titel: "",
    ort: "",
    sprache: "de",
    status: "bereit",
    version: 1,
    parentId: null,
    teilnehmer: [],
    kundeEmail: "",
    kopieEmail: "",
    bemerkung: "",
    beginnAt: null,
    abgeschlossenAt: null,
    originalPath: null,
    pdfPath: null,
    rev: 0,
    maengel: [],
    fotos: [],
    unterschriften: [],
    ...base,
    raeume,
    positionen,
  };
}
