import { validiereKundeKommission, type KundeKommission } from "./kommission.ts";
import type { ProtokollDoc } from "./types.ts";

/**
 * Prüft ein neu anzulegendes Protokoll (manuell oder Import). Wird im Browser (Prüfliste) und
 * auf dem Server (legeProtokollAn) mit derselben Funktion verwendet. Leere Liste = in Ordnung.
 */
export function validiereNeuesProtokoll(doc: ProtokollDoc, kk: KundeKommission): string[] {
  const probleme = validiereKundeKommission(kk);
  const relevante = doc.positionen.filter((p) => p.relevant);
  if (doc.raeume.length === 0) probleme.push("Mindestens ein Raum ist nötig.");
  if (doc.raeume.some((r) => !r.name.trim())) probleme.push("Jeder Raum braucht einen Namen.");
  if (relevante.length === 0) probleme.push("Mindestens eine abnahmerelevante Position ist nötig.");
  if (relevante.some((p) => !p.raumId || !doc.raeume.some((r) => r.id === p.raumId))) {
    probleme.push("Jede abnahmerelevante Position braucht einen Raum.");
  }
  if (relevante.some((p) => !p.titel.trim())) probleme.push("Jede Position braucht einen Titel.");
  if (relevante.some((p) => p.pruefpunkte.some((k) => !k.textDe.trim()))) probleme.push("Prüfpunkte dürfen nicht leer sein.");
  return probleme;
}
