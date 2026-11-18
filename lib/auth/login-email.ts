/**
 * Mitarbeiter ohne eigene E-Mail melden sich über ihren Namen an. Supabase Auth
 * braucht intern trotzdem eine E-Mail-Identität — dafür wird eine technische
 * Adresse aus dem (eindeutigen) Kürzel erzeugt. example.com ist reserviert und
 * hat keinen Mailserver; es wird also nie eine Mail dorthin zugestellt.
 */
const SYNTHETIC_DOMAIN = "mitarbeiter.schlutte.example.com";

export function syntheticLoginEmail(initials: string): string {
  const local = initials.toLowerCase().replace(/[^a-z0-9]/g, "") || "ma";
  return `${local}@${SYNTHETIC_DOMAIN}`;
}

export function isSyntheticLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_DOMAIN}`);
}
