import type { Bezug, Mangel, Position, ProtokollDoc, PruefStatus, Unterschrift } from "./types.ts";

/** Fachlogik der Begehung – rein, ohne Browser; die UI ruft nur diese Funktionen auf. */

export type ItemRef = { positionId: string; pruefpunktId: string | null };

export function relevantePositionen(doc: ProtokollDoc, raumId?: string | null): Position[] {
  return doc.positionen.filter((p) => p.relevant && (raumId === undefined || p.raumId === raumId));
}

/** Status einer Position aus ihren Prüfpunkten (ohne Prüfpunkte: eigener Status). */
export function positionStatus(pos: Position): PruefStatus {
  if (pos.pruefpunkte.length === 0) return pos.status;
  const s = pos.pruefpunkte.map((k) => k.status);
  if (s.includes("mangel")) return "mangel";
  if (s.includes("offen")) return "offen";
  if (s.every((x) => x === "nicht_pruefbar")) return "nicht_pruefbar";
  return "io";
}

function mitStatus(pos: Position): Position {
  return { ...pos, status: positionStatus(pos) };
}

export function findeMangel(doc: ProtokollDoc, ref: ItemRef): Mangel | undefined {
  return doc.maengel.find((m) => m.positionId === ref.positionId && m.pruefpunktId === ref.pruefpunktId);
}

function neueMangelNr(doc: ProtokollDoc): number {
  return doc.maengel.reduce((n, m) => Math.max(n, m.sort), -1) + 1;
}

function mitItemStatus(doc: ProtokollDoc, ref: ItemRef, status: PruefStatus): ProtokollDoc {
  return {
    ...doc,
    positionen: doc.positionen.map((p) => {
      if (p.id !== ref.positionId) return p;
      if (ref.pruefpunktId === null) return mitStatus({ ...p, status });
      return mitStatus({ ...p, pruefpunkte: p.pruefpunkte.map((k) => (k.id === ref.pruefpunktId ? { ...k, status } : k)) });
    }),
  };
}

/** Setzt i. O. / nicht prüfbar / offen. Ein vorhandener Mangel wird entfernt; die IDs seiner Fotos werden zurückgegeben. */
export function setzeStatus(
  doc: ProtokollDoc,
  ref: ItemRef,
  status: Exclude<PruefStatus, "mangel">
): { doc: ProtokollDoc; entfernteFotos: string[] } {
  const mangel = findeMangel(doc, ref);
  let next = mitItemStatus(doc, ref, status);
  const entfernte = mangel ? next.fotos.filter((f) => f.mangelId === mangel.id).map((f) => f.id) : [];
  if (mangel) {
    next = { ...next, maengel: next.maengel.filter((m) => m.id !== mangel.id), fotos: next.fotos.filter((f) => f.mangelId !== mangel.id) };
  }
  return { doc: next, entfernteFotos: entfernte };
}

/** Legt einen Mangel an oder aktualisiert ihn. Bemerkung ist Pflicht. */
export function setzeMangel(
  doc: ProtokollDoc,
  ref: ItemRef,
  eingabe: { text: string; frist: string }
): ProtokollDoc {
  const text = eingabe.text.trim();
  if (!text) throw new Error("Bei einem Mangel ist eine Bemerkung Pflicht.");
  const pos = doc.positionen.find((p) => p.id === ref.positionId);
  if (!pos) throw new Error("Position nicht gefunden.");
  const vorhanden = findeMangel(doc, ref);
  const maengel: Mangel[] = vorhanden
    ? doc.maengel.map((m) => (m.id === vorhanden.id ? { ...m, text, frist: eingabe.frist } : m))
    : [
        ...doc.maengel,
        {
          id: crypto.randomUUID(), raumId: pos.raumId, positionId: ref.positionId, pruefpunktId: ref.pruefpunktId,
          sort: neueMangelNr(doc), text, frist: eingabe.frist, erledigtAt: null,
        },
      ];
  return mitItemStatus({ ...doc, maengel }, ref, "mangel");
}

/** „Alle Positionen im Raum i. O.“ – Positionen/Prüfpunkte mit Mangel bleiben unberührt. */
export function raumAlleIo(doc: ProtokollDoc, raumId: string): ProtokollDoc {
  return setzeMehrere(doc, relevantePositionen(doc, raumId).map((p) => p.id), "io");
}

/** Mehrere Positionen gemeinsam setzen (i. O. oder nicht prüfbar); Mängel bleiben bestehen. */
export function setzeMehrere(doc: ProtokollDoc, positionIds: string[], status: "io" | "nicht_pruefbar"): ProtokollDoc {
  const ids = new Set(positionIds);
  const mangelRefs = new Set(doc.maengel.map((m) => `${m.positionId}|${m.pruefpunktId}`));
  return {
    ...doc,
    positionen: doc.positionen.map((p) => {
      if (!ids.has(p.id) || !p.relevant) return p;
      if (p.pruefpunkte.length === 0) {
        return mangelRefs.has(`${p.id}|null`) ? p : mitStatus({ ...p, status });
      }
      return mitStatus({
        ...p,
        pruefpunkte: p.pruefpunkte.map((k) => (mangelRefs.has(`${p.id}|${k.id}`) ? k : { ...k, status })),
      });
    }),
  };
}

export type Fortschritt = { gesamt: number; offen: number; io: number; mangel: number; nichtPruefbar: number };

export function fortschritt(positionen: Position[]): Fortschritt {
  const f: Fortschritt = { gesamt: positionen.length, offen: 0, io: 0, mangel: 0, nichtPruefbar: 0 };
  for (const p of positionen) {
    const s = positionStatus(p);
    if (s === "offen") f.offen++;
    else if (s === "io") f.io++;
    else if (s === "mangel") f.mangel++;
    else f.nichtPruefbar++;
  }
  return f;
}

export function findeUnterschrift(doc: ProtokollDoc, bezug: Bezug, bezugId: string | null): Unterschrift | undefined {
  return doc.unterschriften.find((u) => u.bezug === bezug && (u.bezugId ?? null) === (bezugId ?? null));
}

/** Ersetzt die Unterschrift gleichen Bezugs; liefert die ID der ersetzten (zum Löschen des Bildes). */
export function setzeUnterschrift(
  doc: ProtokollDoc,
  u: Omit<Unterschrift, "bildPath" | "zeitpunkt"> & { zeitpunkt?: string }
): { doc: ProtokollDoc; ersetzt: string | null } {
  const alt = findeUnterschrift(doc, u.bezug, u.bezugId);
  const neu: Unterschrift = { ...u, bildPath: null, zeitpunkt: u.zeitpunkt ?? new Date().toISOString() };
  return {
    doc: { ...doc, unterschriften: [...doc.unterschriften.filter((x) => x.id !== alt?.id), neu] },
    ersetzt: alt?.id ?? null,
  };
}

/** Positionen mit Mangel brauchen zusätzlich eine eigene Unterschrift. */
export function maengelPositionen(doc: ProtokollDoc): Position[] {
  return relevantePositionen(doc).filter((p) => positionStatus(p) === "mangel");
}

export type OffeneUnterschriften = { raeume: string[]; positionen: string[] };

export function offeneUnterschriften(doc: ProtokollDoc): OffeneUnterschriften {
  const raeume = doc.raeume
    .filter((r) => relevantePositionen(doc, r.id).length > 0 && !findeUnterschrift(doc, "raum", r.id))
    .map((r) => r.id);
  const positionen = maengelPositionen(doc)
    .filter((p) => !findeUnterschrift(doc, "position", p.id))
    .map((p) => p.id);
  return { raeume, positionen };
}

export function kannAbschliessen(doc: ProtokollDoc): { ok: boolean; gruende: string[] } {
  const gruende: string[] = [];
  const offen = relevantePositionen(doc).filter((p) => positionStatus(p) === "offen").length;
  if (offen > 0) gruende.push(`${offen} Position${offen === 1 ? "" : "en"} noch nicht geprüft`);
  if (doc.maengel.some((m) => !m.text.trim())) gruende.push("Ein Mangel hat keine Bemerkung");
  if (!findeUnterschrift(doc, "schluss_kunde", null)) gruende.push("Schlussunterschrift Kunde fehlt");
  if (!findeUnterschrift(doc, "schluss_mitarbeiter", null)) gruende.push("Schlussunterschrift Mitarbeiter fehlt");
  if (!doc.ort.trim()) gruende.push("Ort fehlt");
  return { ok: gruende.length === 0, gruende };
}

export const STATUS_LABEL: Record<"de" | "en", Record<PruefStatus, string>> = {
  de: { offen: "offen", io: "i. O.", mangel: "Mangel", nicht_pruefbar: "nicht prüfbar" },
  en: { offen: "open", io: "OK", mangel: "Defect", nicht_pruefbar: "not testable" },
};

// ─── Eigene Positionen und Prüfpunkte (nachträglich, auch auf der Baustelle) ────

/** Kennzeichen selbst angelegter Positionen (Profacto-Positionen haben ein anderes Artikelkürzel). */
export const MANUELL = "manuell";
export const istManuell = (p: Position) => p.artikel === MANUELL;

export function fuegePositionHinzu(
  doc: ProtokollDoc,
  raumId: string,
  eingabe: { titel: string; menge?: string; einheit?: string; langtext?: string; vorlageId?: string | null; pruefpunkte?: { de: string; en?: string }[] }
): ProtokollDoc {
  const titel = eingabe.titel.trim();
  if (!titel) throw new Error("Bitte einen Titel eingeben.");
  if (!doc.raeume.some((r) => r.id === raumId)) throw new Error("Raum nicht gefunden.");
  const nr = `N${doc.positionen.filter(istManuell).length + 1}`;
  const pos: Position = {
    id: crypto.randomUUID(), raumId, sort: doc.positionen.reduce((n, p) => Math.max(n, p.sort), -1) + 1, nr,
    menge: (eingabe.menge ?? "").trim(), einheit: (eingabe.einheit ?? "").trim(), artikel: MANUELL, titel,
    langtext: (eingabe.langtext ?? "").trim(), relevant: true, vorlageId: eingabe.vorlageId ?? null, status: "offen", bemerkung: "",
    pruefpunkte: (eingabe.pruefpunkte ?? [])
      .filter((k) => k.de.trim())
      .map((k, i) => ({ id: crypto.randomUUID(), sort: i, textDe: k.de.trim(), textEn: (k.en ?? "").trim() || k.de.trim(), status: "offen" as const, bemerkung: "" })),
  };
  return { ...doc, positionen: [...doc.positionen, mitStatus(pos)] };
}

/** Zusätzlicher Prüfpunkt an einer Position. Hat die Position schon einen Mangel als Ganzes, wird abgelehnt. */
export function fuegePruefpunktHinzu(doc: ProtokollDoc, positionId: string, textDe: string, textEn = ""): ProtokollDoc {
  const text = textDe.trim();
  if (!text) throw new Error("Bitte einen Text für den Prüfpunkt eingeben.");
  const pos = doc.positionen.find((p) => p.id === positionId);
  if (!pos) throw new Error("Position nicht gefunden.");
  if (pos.pruefpunkte.length === 0 && findeMangel(doc, { positionId, pruefpunktId: null })) {
    throw new Error("Diese Position hat schon einen Mangel als Ganzes. Bitte zuerst den Mangel zurücksetzen.");
  }
  // Eine bisher als Ganzes geprüfte Position (i. O./nicht prüfbar) behält diesen Status für den neuen Punkt nicht:
  // der neue Prüfpunkt ist „offen“.
  const k = { id: crypto.randomUUID(), sort: pos.pruefpunkte.reduce((n, x) => Math.max(n, x.sort), -1) + 1, textDe: text, textEn: textEn.trim() || text, status: "offen" as const, bemerkung: "" };
  return { ...doc, positionen: doc.positionen.map((p) => (p.id === positionId ? mitStatus({ ...p, pruefpunkte: [...p.pruefpunkte, k] }) : p)) };
}

export function entfernePruefpunkt(doc: ProtokollDoc, positionId: string, pruefpunktId: string): { doc: ProtokollDoc; entfernteFotos: string[] } {
  const mangel = findeMangel(doc, { positionId, pruefpunktId });
  const entfernte = mangel ? doc.fotos.filter((f) => f.mangelId === mangel.id).map((f) => f.id) : [];
  return {
    entfernteFotos: entfernte,
    doc: {
      ...doc,
      maengel: mangel ? doc.maengel.filter((m) => m.id !== mangel.id) : doc.maengel,
      fotos: mangel ? doc.fotos.filter((f) => f.mangelId !== mangel.id) : doc.fotos,
      positionen: doc.positionen.map((p) => (p.id === positionId ? mitStatus({ ...p, pruefpunkte: p.pruefpunkte.filter((k) => k.id !== pruefpunktId) }) : p)),
    },
  };
}

/** Entfernt eine selbst angelegte Position samt Mängeln, Fotos und Unterschriften. Profacto-Positionen bleiben (nur ausblenden). */
export function entfernePosition(doc: ProtokollDoc, positionId: string): { doc: ProtokollDoc; entfernteBilder: string[] } {
  const pos = doc.positionen.find((p) => p.id === positionId);
  if (!pos || !istManuell(pos)) throw new Error("Nur selbst angelegte Positionen lassen sich entfernen.");
  const mangelIds = new Set(doc.maengel.filter((m) => m.positionId === positionId).map((m) => m.id));
  const fotos = doc.fotos.filter((f) => mangelIds.has(f.mangelId)).map((f) => f.id);
  const sigs = doc.unterschriften.filter((u) => u.bezug === "position" && u.bezugId === positionId).map((u) => u.id);
  const objekt = (doc.objektFotos ?? []).filter((f) => f.positionId === positionId).map((f) => f.id);
  return {
    entfernteBilder: [...fotos, ...sigs, ...objekt],
    doc: {
      ...doc,
      objektFotos: (doc.objektFotos ?? []).filter((f) => f.positionId !== positionId),
      positionen: doc.positionen.filter((p) => p.id !== positionId),
      maengel: doc.maengel.filter((m) => !mangelIds.has(m.id)),
      fotos: doc.fotos.filter((f) => !mangelIds.has(f.mangelId)),
      unterschriften: doc.unterschriften.filter((u) => !sigs.includes(u.id)),
    },
  };
}

/**
 * Entfernt einen Raum samt aller seiner Positionen (auch ausgeblendeter), Prüfpunkte, Mängel, Fotos und Unterschriften
 * (Raum- und Positions-Unterschriften). Gibt die IDs der zu löschenden lokalen Bilder zurück.
 */
export function entferneRaum(doc: ProtokollDoc, raumId: string): { doc: ProtokollDoc; entfernteBilder: string[]; positionen: number } {
  if (!doc.raeume.some((r) => r.id === raumId)) throw new Error("Raum nicht gefunden.");
  const posIds = new Set(doc.positionen.filter((p) => p.raumId === raumId).map((p) => p.id));
  const mangelIds = new Set(doc.maengel.filter((m) => m.raumId === raumId || (m.positionId && posIds.has(m.positionId))).map((m) => m.id));
  const fotos = doc.fotos.filter((f) => mangelIds.has(f.mangelId)).map((f) => f.id);
  const sigIds = doc.unterschriften
    .filter((u) => (u.bezug === "raum" && u.bezugId === raumId) || (u.bezug === "position" && u.bezugId && posIds.has(u.bezugId)))
    .map((u) => u.id);
  const objekt = (doc.objektFotos ?? []).filter((f) => posIds.has(f.positionId)).map((f) => f.id);
  return {
    entfernteBilder: [...fotos, ...sigIds, ...objekt],
    positionen: posIds.size,
    doc: {
      ...doc,
      objektFotos: (doc.objektFotos ?? []).filter((f) => !posIds.has(f.positionId)),
      raeume: doc.raeume.filter((r) => r.id !== raumId).map((r, i) => ({ ...r, sort: i })),
      positionen: doc.positionen.filter((p) => !posIds.has(p.id)),
      maengel: doc.maengel.filter((m) => !mangelIds.has(m.id)),
      fotos: doc.fotos.filter((f) => !mangelIds.has(f.mangelId)),
      unterschriften: doc.unterschriften.filter((u) => !sigIds.includes(u.id)),
    },
  };
}

/** Objektfotos einer Position. */
export const objektFotosVon = (doc: ProtokollDoc, positionId: string) => (doc.objektFotos ?? []).filter((f) => f.positionId === positionId);

/** Fügt ein Objektfoto an einer Position hinzu (das Bild selbst liegt als Blob lokal). */
export function fuegeObjektFotoHinzu(doc: ProtokollDoc, positionId: string, foto: { id: string; breite: number; hoehe: number }): ProtokollDoc {
  if (!doc.positionen.some((p) => p.id === positionId)) throw new Error("Position nicht gefunden.");
  return {
    ...doc,
    objektFotos: [...(doc.objektFotos ?? []), { id: foto.id, positionId, path: null, breite: foto.breite, hoehe: foto.hoehe, aufgenommenAt: new Date().toISOString() }],
  };
}

export function entferneObjektFoto(doc: ProtokollDoc, fotoId: string): ProtokollDoc {
  return { ...doc, objektFotos: (doc.objektFotos ?? []).filter((f) => f.id !== fotoId) };
}
