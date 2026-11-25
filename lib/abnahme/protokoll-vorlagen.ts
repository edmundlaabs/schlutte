import { baueDokumentPruefpunkte, naechsteNr } from "./edit.ts";
import type { Position, ProtokollDoc, ProtokollVorlage, Raum, Vorlage, VorlageRaum } from "./types.ts";

const norm = (s: string) => s.trim().toLocaleLowerCase("de");

/**
 * Fügt eine Protokoll-Vorlage in ein Protokoll ein (mehrfach möglich).
 * - Räume gleichen Namens werden zusammengeführt (Etage/Material nur ergänzt, wenn leer), sonst neu angelegt.
 * - Alle Räume, Positionen und Prüfpunkte erhalten neue IDs; Status offen; Positionen hängen am Ende des Raums.
 * - Prüfpunkte = aktive Möbeltyp-Vorlage + eigene der Vorlagenposition. Fehlt die Möbeltyp-Vorlage oder ist sie
 *   inaktiv, bleiben nur die eigenen Prüfpunkte und es gibt einen Hinweis.
 */
export function fuegeVorlageEin(
  doc: ProtokollDoc,
  vorlage: Pick<ProtokollVorlage, "raeume">,
  moebeltypVorlagen: readonly Vorlage[]
): { doc: ProtokollDoc; hinweise: string[] } {
  const hinweise: string[] = [];
  const raeume: Raum[] = doc.raeume.map((r) => ({ ...r }));
  const positionen: Position[] = [...doc.positionen];
  let sortPos = positionen.reduce((n, p) => Math.max(n, p.sort), -1) + 1;

  for (const vr of vorlage.raeume) {
    let raum = raeume.find((r) => norm(r.name) === norm(vr.name));
    if (raum) {
      if (!raum.etage.trim() && vr.etage.trim()) raum.etage = vr.etage;
      if (!raum.materialText.trim() && vr.materialText.trim()) raum.materialText = vr.materialText;
    } else {
      raum = { id: crypto.randomUUID(), sort: raeume.length, name: vr.name.trim(), etage: vr.etage, materialText: vr.materialText, bemerkung: "" };
      raeume.push(raum);
    }
    for (const vp of vr.positionen) {
      let punkte: { de: string; en?: string }[] = [];
      let vorlageId: string | null = null;
      if (vp.vorlageId) {
        const mv = moebeltypVorlagen.find((v) => v.id === vp.vorlageId && v.aktiv);
        if (mv) {
          vorlageId = mv.id;
          punkte = [...mv.punkte];
        } else {
          hinweise.push(`Position „${vp.titel}“: Die Möbeltyp-Vorlage ist nicht mehr verfügbar, Prüfpunkte daraus fehlen.`);
        }
      }
      punkte = [...punkte, ...vp.pruefpunkte];
      const pos: Position = {
        id: crypto.randomUUID(),
        raumId: raum.id,
        sort: sortPos++,
        nr: naechsteNr({ positionen }),
        menge: "",
        einheit: vp.einheit,
        artikel: "",
        titel: vp.titel,
        langtext: vp.beschreibung,
        relevant: true,
        vorlageId,
        status: "offen",
        bemerkung: "",
        pruefpunkte: baueDokumentPruefpunkte(punkte),
      };
      positionen.push(pos);
    }
  }
  return { doc: { ...doc, raeume: raeume.map((r, i) => ({ ...r, sort: i })), positionen }, hinweise };
}

/**
 * Struktur eines Protokolls als Vorlage (ohne Kunden-/Kommissionsdaten, Mengen und Status).
 * Bei Positionen mit Möbeltyp-Vorlage werden nur Prüfpunkte gespeichert, die nicht aus der Vorlage stammen.
 */
export function strukturAusDoc(doc: ProtokollDoc, moebeltypVorlagen: readonly Vorlage[]): VorlageRaum[] {
  return doc.raeume
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      etage: r.etage,
      materialText: r.materialText,
      positionen: doc.positionen
        .filter((p) => p.raumId === r.id && p.relevant && p.titel.trim())
        .map((p) => {
          const mv = p.vorlageId ? moebeltypVorlagen.find((v) => v.id === p.vorlageId) : undefined;
          const ausVorlage = new Set((mv?.punkte ?? []).map((k) => norm(k.de)));
          return {
            titel: p.titel.trim(),
            einheit: p.einheit,
            beschreibung: p.langtext,
            vorlageId: mv ? mv.id : null,
            pruefpunkte: p.pruefpunkte
              .filter((k) => !ausVorlage.has(norm(k.textDe)))
              .map((k) => ({ de: k.textDe, en: k.textEn || k.textDe })),
          };
        }),
    }));
}

export function zaehleVorlage(raeume: readonly VorlageRaum[]): { raeume: number; positionen: number } {
  return { raeume: raeume.length, positionen: raeume.reduce((n, r) => n + r.positionen.length, 0) };
}

/** Bereinigt eine Vorlagenstruktur vor dem Speichern: Texte trimmen, leere Räume/Positionen/Prüfpunkte entfernen. */
export function bereinigeStruktur(raeume: readonly VorlageRaum[]): VorlageRaum[] {
  return raeume
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      etage: r.etage.trim(),
      materialText: r.materialText.trim(),
      positionen: r.positionen
        .filter((p) => p.titel.trim())
        .map((p) => ({
          titel: p.titel.trim(),
          einheit: p.einheit.trim(),
          beschreibung: p.beschreibung.trim(),
          vorlageId: p.vorlageId || null,
          pruefpunkte: p.pruefpunkte.filter((k) => k.de.trim()).map((k) => ({ de: k.de.trim(), en: k.en.trim() || k.de.trim() })),
        })),
    }));
}
