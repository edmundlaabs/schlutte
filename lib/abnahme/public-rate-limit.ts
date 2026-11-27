/**
 * Einfaches Limit für ungültige Token-Abrufe pro IP (best effort, ohne neue Infrastruktur).
 * Der Zähler liegt im Speicher der jeweiligen Serverinstanz: auf Vercel gilt er je Instanz und ist daher nur eine
 * Bremse gegen simples Durchprobieren. Der eigentliche Schutz ist der Token (192 Bit). Zusätzlich empfohlen:
 * Vercel-Firewall-Regel „Rate Limit“ auf /p/* (siehe docs/ABNAHME.md).
 */
const FENSTER_MS = 10 * 60 * 1000;
const MAX_FEHLVERSUCHE = 30;
const zaehler = new Map<string, { n: number; bis: number }>();

export function istGesperrt(ip: string, jetzt = Date.now()): boolean {
  const e = zaehler.get(ip);
  if (!e || e.bis < jetzt) return false;
  return e.n >= MAX_FEHLVERSUCHE;
}

export function meldeFehlversuch(ip: string, jetzt = Date.now()): void {
  const e = zaehler.get(ip);
  if (!e || e.bis < jetzt) zaehler.set(ip, { n: 1, bis: jetzt + FENSTER_MS });
  else e.n++;
  // Speicher begrenzen
  if (zaehler.size > 5000) for (const [k, v] of zaehler) if (v.bis < jetzt) zaehler.delete(k);
}

export function zuruecksetzenFuerTest() {
  zaehler.clear();
}
