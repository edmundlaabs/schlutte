import type { Mangel, Position, ProtokollDoc, Raum, Unterschrift } from "./types.ts";
import { fortschritt, findeUnterschrift, positionStatus, relevantePositionen } from "./logic.ts";
import { pfadOriginal, pfadVorschau } from "./foto-pfade.ts";

/**
 * Reduziertes Datenmodell der öffentlichen Seite. Enthält nur, was auch im PDF steht – keine IDs von Mitarbeitern,
 * keine E-Mail-Adressen, keine Speicherpfade (Bilder kommen als kurzlebige Signed URLs).
 */
export type PublicFoto = { id: string; vorschau: string | null; original: string | null; breite: number; hoehe: number; caption: string };
export type PublicMangel = { nr: string; raum: string; position: string; text: string; frist: string; erledigt: boolean; fotos: PublicFoto[] };
export type PublicPruefpunkt = { text: string; status: "offen" | "io" | "mangel" | "nicht_pruefbar" };
export type PublicPosition = {
  nr: string; titel: string; menge: string; einheit: string; langtext: string; bemerkung: string;
  status: "offen" | "io" | "mangel" | "nicht_pruefbar"; pruefpunkte: PublicPruefpunkt[]; fotos: PublicFoto[];
};
export type PublicSignatur = { name: string; rolle: string; zeitpunkt: string; bild: string | null; titel: string };
export type PublicRaum = {
  id: string; name: string; etage: string; material: string; bemerkung: string;
  zaehler: { gesamt: number; io: number; mangel: number; nichtPruefbar: number; offen: number };
  positionen: PublicPosition[]; ausgeblendet: PublicPosition[]; signaturen: PublicSignatur[];
};
export type PublicModell = {
  sprache: "de" | "en"; version: number; kommission: string; kunde: string; projekt: string; titel: string; ort: string;
  datum: string | null; mitarbeiter: string; teilnehmer: { name: string; rolle: string }[]; bemerkung: string;
  raeume: PublicRaum[]; maengel: PublicMangel[]; schluss: PublicSignatur[]; hatPdf: boolean;
  objektFotoAnzahl: number; maengelFotoAnzahl: number;
};

/** Alle Storage-Pfade, die für die Seite signiert werden müssen (Vorschau, Original, Unterschriften). */
export function sammlePfade(doc: ProtokollDoc): string[] {
  const set = new Set<string>();
  for (const f of [...doc.fotos, ...(doc.objektFotos ?? [])]) {
    const a = pfadVorschau(f);
    const b = pfadOriginal(f);
    if (a) set.add(a);
    if (b) set.add(b);
  }
  for (const u of doc.unterschriften) if (u.bildPath) set.add(u.bildPath);
  return [...set];
}

export function baueModell(doc: ProtokollDoc, signed: Record<string, string>, hatPdf: boolean): PublicModell {
  const url = (p: string | null) => (p ? signed[p] ?? null : null);
  const raumName = (id: string | null) => doc.raeume.find((r) => r.id === id)?.name ?? "";
  const maengelSortiert = [...doc.maengel].sort((a, b) => a.sort - b.sort);
  const mangelNr = (m: Mangel) => `M${maengelSortiert.indexOf(m) + 1}`;
  const posTitel = (p: Position | undefined) => (p ? `${p.nr} ${p.titel}`.trim() : "");

  const sig = (u: Unterschrift | undefined, titel: string): PublicSignatur[] =>
    u ? [{ name: u.name, rolle: u.rolle, zeitpunkt: u.zeitpunkt, bild: url(u.bildPath), titel }] : [];

  const maengel: PublicMangel[] = maengelSortiert.map((m) => {
    const p = doc.positionen.find((x) => x.id === m.positionId);
    const nr = mangelNr(m);
    return {
      nr, raum: raumName(m.raumId ?? p?.raumId ?? null), position: posTitel(p), text: m.text, frist: m.frist, erledigt: Boolean(m.erledigtAt),
      fotos: doc.fotos.filter((f) => f.mangelId === m.id).map((f, i) => ({
        id: f.id, vorschau: url(pfadVorschau(f)), original: url(pfadOriginal(f)), breite: f.breite, hoehe: f.hoehe,
        caption: `${nr}.${i + 1} · ${m.text}`,
      })),
    };
  });

  const posModell = (p: Position, raum: Raum): PublicPosition => ({
    nr: p.nr, titel: p.titel, menge: p.menge, einheit: p.einheit, langtext: p.langtext, bemerkung: p.bemerkung,
    status: positionStatus(p),
    pruefpunkte: p.pruefpunkte.map((k) => ({ text: doc.sprache === "en" ? k.textEn || k.textDe : k.textDe, status: k.status })),
    fotos: (doc.objektFotos ?? []).filter((f) => f.positionId === p.id).map((f) => ({
      id: f.id, vorschau: url(pfadVorschau(f)), original: url(pfadOriginal(f)), breite: f.breite, hoehe: f.hoehe,
      caption: `${raum.name} · ${posTitel(p)}`,
    })),
  });

  const raeume: PublicRaum[] = doc.raeume
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .filter((r) => doc.positionen.some((p) => p.raumId === r.id))
    .map((r) => {
      const alle = doc.positionen.filter((p) => p.raumId === r.id).sort((a, b) => a.sort - b.sort);
      const rel = relevantePositionen(doc, r.id).sort((a, b) => a.sort - b.sort);
      const f = fortschritt(rel);
      return {
        id: r.id, name: r.name, etage: r.etage, material: r.materialText, bemerkung: r.bemerkung,
        zaehler: { gesamt: f.gesamt, io: f.io, mangel: f.mangel, nichtPruefbar: f.nichtPruefbar, offen: f.offen },
        positionen: rel.map((p) => posModell(p, r)),
        ausgeblendet: alle.filter((p) => !p.relevant).map((p) => posModell(p, r)),
        signaturen: sig(findeUnterschrift(doc, "raum", r.id), "raum"),
      };
    })
    .filter((r) => r.positionen.length > 0 || r.ausgeblendet.length > 0);

  return {
    sprache: doc.sprache, version: doc.version, kommission: doc.kommissionNr, kunde: doc.kunde, projekt: doc.projekt, titel: doc.titel, ort: doc.ort,
    datum: doc.abgeschlossenAt ?? doc.beginnAt, mitarbeiter: doc.mitarbeiterName,
    teilnehmer: doc.teilnehmer.map((t) => ({ name: t.name, rolle: t.rolle ?? "" })), bemerkung: doc.bemerkung,
    raeume, maengel,
    schluss: [...sig(findeUnterschrift(doc, "schluss_kunde", null), "kunde"), ...sig(findeUnterschrift(doc, "schluss_mitarbeiter", null), "mitarbeiter")],
    hatPdf,
    objektFotoAnzahl: raeume.reduce((n, r) => n + r.positionen.reduce((m, p) => m + p.fotos.length, 0), 0),
    maengelFotoAnzahl: maengel.reduce((n, m) => n + m.fotos.length, 0),
  };
}
