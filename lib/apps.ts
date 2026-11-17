/**
 * App-Register des Intranets — eine App je Hub-Kachel.
 * Reine Daten ohne Server-Abhängigkeiten (auch in Client-Komponenten nutzbar).
 *
 * Der Admin vergibt pro Mitarbeiter, welche Apps freigeschaltet sind
 * (employees.app_access). CEO und Admin haben immer Zugriff auf alle Apps.
 *
 * enforcement:
 *  - "intern": Seiten der Schlutte, serverseitig per requireAppAccess() geschützt.
 *  - "datenbank": eigenständige App am selben Supabase-Projekt (Login + Daten);
 *              Zugriff per Row Level Security, public.has_app_access() — Gerda.
 *  - "kachel": externe App ohne Anbindung — nur die Kachel wird ausgeblendet,
 *              die App selbst prüft die Berechtigung (noch) nicht.
 */

export type AppKey =
  | "gerda"
  | "werkstatt"
  | "personal"
  | "warenbestand"
  | "bestellliste"
  | "urlaub"
  | "hoellental"
  | "auslagen";

export type AppDefinition = {
  key: AppKey;
  title: string;
  enforcement: "intern" | "datenbank" | "kachel";
  live: boolean;
};

export const APPS: readonly AppDefinition[] = [
  { key: "gerda", title: "Gerda", enforcement: "datenbank", live: true },
  { key: "werkstatt", title: "Druckvorlagen Werkstatt", enforcement: "intern", live: true },
  { key: "personal", title: "Druckvorlagen Personal", enforcement: "intern", live: false },
  { key: "warenbestand", title: "Warenbestand WERK 2", enforcement: "kachel", live: true },
  { key: "bestellliste", title: "Bestellliste", enforcement: "intern", live: true },
  { key: "urlaub", title: "Urlaubsantrag", enforcement: "intern", live: false },
  { key: "hoellental", title: "Höllental", enforcement: "kachel", live: true },
  { key: "auslagen", title: "Auslagen & Belege", enforcement: "intern", live: true },
];

export const ALL_APP_KEYS: readonly AppKey[] = APPS.map((app) => app.key);

export function isAppKey(value: unknown): value is AppKey {
  return typeof value === "string" && (ALL_APP_KEYS as readonly string[]).includes(value);
}

export function appTitle(key: AppKey): string {
  return APPS.find((app) => app.key === key)?.title ?? key;
}

/** Beliebige Eingabe (DB-Array, FormData-Werte) → gültige, eindeutige App-Keys. */
export function parseAppKeys(values: unknown): AppKey[] {
  if (!Array.isArray(values)) return [];
  return ALL_APP_KEYS.filter((key) => values.includes(key));
}

/**
 * Effektive Freischaltungen eines Mitarbeiters.
 *  - CEO/Admin: immer alle Apps (kann sich nicht selbst aussperren).
 *  - appAccess undefined/null: Spalte fehlt noch (Migration nicht gelaufen)
 *    → alle Apps, damit bis dahin niemand ausgesperrt wird.
 *  - sonst: genau die vergebenen Apps.
 */
export function resolveAppAccess(
  appAccess: readonly string[] | null | undefined,
  hasAdminRights: boolean
): AppKey[] {
  if (hasAdminRights || appAccess == null) return [...ALL_APP_KEYS];
  return parseAppKeys(appAccess);
}
