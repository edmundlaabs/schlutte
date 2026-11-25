import type { KundeKommission } from "./kommission.ts";
import type { ProtokollDoc } from "./types.ts";

/**
 * Zwischenspeicher für das manuell angelegte Protokoll, solange es noch nicht angelegt ist.
 * localStorage reicht: der Entwurf ist reiner Text (wenige KB), keine Fotos/Unterschriften.
 * Der Schlüssel enthält den Nutzer, damit sich Mitarbeiter ein Tablet teilen können.
 */
export type Entwurf = {
  v: 1;
  savedAt: string;
  doc: ProtokollDoc;
  kk: KundeKommission;
  /** Wurde mindestens eine Protokoll-Vorlage eingefügt? (→ quelle „vorlage“) */
  ausVorlage: boolean;
};

const key = (nutzer: string) => `abnahme-neu-entwurf:${nutzer || "anonym"}`;

export function ladeEntwurf(nutzer: string): Entwurf | null {
  try {
    const raw = window.localStorage.getItem(key(nutzer));
    if (!raw) return null;
    const e = JSON.parse(raw) as Entwurf;
    return e?.v === 1 && e.doc && e.kk ? e : null;
  } catch {
    return null;
  }
}

export function speichereEntwurf(nutzer: string, e: Omit<Entwurf, "v" | "savedAt">): void {
  try {
    window.localStorage.setItem(key(nutzer), JSON.stringify({ v: 1, savedAt: new Date().toISOString(), ...e }));
  } catch {
    /* nicht verfügbar oder voll: der Entwurf geht dann nur bei Neuladen verloren */
  }
}

export function loescheEntwurf(nutzer: string): void {
  try {
    window.localStorage.removeItem(key(nutzer));
  } catch {
    /* nicht verfügbar */
  }
}
