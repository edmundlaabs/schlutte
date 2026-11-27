const MB = 1024 * 1024;
/** Warnschwelle: weniger als 400 MB frei oder mehr als 85 % belegt (Originale sind 2–5 MB je Foto). */
export function speicherKnapp(s: { belegt: number; quota: number } | null): boolean {
  if (!s || !s.quota) return false;
  return s.quota - s.belegt < 400 * MB || s.belegt / s.quota > 0.85;
}
