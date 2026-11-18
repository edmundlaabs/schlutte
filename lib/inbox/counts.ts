/** Reine Logik für die roten Punkte (ohne Server-Abhängigkeiten, testbar). */

export type InboxCounts = {
  urlaub: number;
  auslagen: number;
  feedback: number;
  registrierungen: number;
};

export type BadgeKey = keyof InboxCounts;

export const EMPTY_INBOX_COUNTS: InboxCounts = { urlaub: 0, auslagen: 0, feedback: 0, registrierungen: 0 };

const LABELS: Record<BadgeKey, [string, string]> = {
  urlaub: ["offener Urlaubsantrag", "offene Urlaubsanträge"],
  auslagen: ["offener Auslagenantrag", "offene Auslagenanträge"],
  feedback: ["offenes Feedback", "offene Feedbacks"],
  registrierungen: ["offene Registrierung", "offene Registrierungen"],
};

/** Beliebige Antwort (RPC-JSON) → gültige, nicht-negative ganze Zahlen. */
export function mapInboxCounts(raw: unknown): InboxCounts {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  return {
    urlaub: num(obj.urlaub),
    auslagen: num(obj.auslagen),
    feedback: num(obj.feedback),
    registrierungen: num(obj.registrierungen),
  };
}

/** Anzeige im Punkt: ab 10 „9+“. */
export function badgeText(count: number): string {
  return count >= 10 ? "9+" : String(count);
}

export function badgeLabel(key: BadgeKey, count: number): string {
  const [one, many] = LABELS[key];
  return `${count} ${count === 1 ? one : many}`;
}

/** Summe für Sammelstellen (z. B. Admin-Eintrag: Feedback + Registrierungen). */
export function sumCounts(counts: InboxCounts, keys: readonly BadgeKey[]): number {
  return keys.reduce((total, key) => total + counts[key], 0);
}

/** Welche Apps (App-Key) welchen Zähler tragen. */
export const APP_BADGE: Partial<Record<string, BadgeKey>> = { urlaub: "urlaub", auslagen: "auslagen" };
