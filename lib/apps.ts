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
 */

export type AppKey =
  | "gerda"
  | "werkstatt"
  | "personal"
  | "warenbestand"
  | "bestellliste"
  | "urlaub"
  | "projekte"
  | "pandacad"
  | "auslagen";

export type AppGroup = "werkstatt-lager" | "buero-personal" | "planung-tools";

export const APP_GROUPS: readonly { key: AppGroup; title: string }[] = [
  { key: "werkstatt-lager", title: "Werkstatt und Lager" },
  { key: "buero-personal", title: "Büro und Personal" },
  { key: "planung-tools", title: "Planung und Tools" },
];

/** Icon-Namen der App-Kacheln und des App-Wechslers (gerendert in components/ui/AppIcon.tsx). */
export type AppIconName =
  | "workshop" | "staff" | "order" | "vacation" | "inventory" | "report" | "receipt" | "cad" | "project";

/** Eintrag der Unternavigation (Zeile 2 der Shell, mobil Tab-Leiste unten). */
export type AppNavItem = {
  label: string;
  href: string;
  /** Zusätzliche Pfad-Präfixe, für die der Tab aktiv ist. */
  match?: string[];
  /** Nur für CEO/Admin sichtbar. */
  finance?: boolean;
  /** Icon der mobilen Tab-Leiste (components/ui/Icon.tsx). */
  icon?: "receipt" | "doc-stripe" | "user" | "card" | "settings" | "home" | "list" | "archive" | "box" | "mail";
  /** Nur bei exakt gleichem Pfad aktiv (z. B. Übersicht-Tab). */
  exact?: boolean;
};

export type AppDefinition = {
  key: AppKey;
  title: string;
  enforcement: "intern" | "datenbank";
  live: boolean;
  href: string;
  group: AppGroup;
  icon: AppIconName;
  /** Kurzbeschreibung für die Startseite. */
  hint: string;
  nav: readonly AppNavItem[];
};

export const APPS: readonly AppDefinition[] = [
  {
    key: "werkstatt", title: "Werkstatt", enforcement: "intern", live: true,
    href: "/werkstatt", group: "werkstatt-lager", icon: "workshop",
    hint: "Kommissionen verwalten, Palettenlabel und Laufzettel erstellen, drucken und archivieren.",
    nav: [
      { label: "Übersicht", href: "/werkstatt", exact: true, icon: "home" },
      { label: "Kommissionen", href: "/werkstatt/kommissionen", match: ["/werkstatt/dokument-erstellen"], icon: "list" },
      { label: "Archiv", href: "/werkstatt/archiv", icon: "archive" },
    ],
  },
  {
    key: "warenbestand", title: "Warenbestand", enforcement: "intern", live: true,
    href: "/warenbestand", group: "werkstatt-lager", icon: "inventory",
    hint: "Mobiles Kommissionslager. Wird in die Schlutte übernommen.",
    nav: [],
  },
  {
    key: "bestellliste", title: "Bestellliste", enforcement: "intern", live: true,
    href: "/bestellliste", group: "werkstatt-lager", icon: "order",
    hint: "Material, Beschläge und Verbrauch erfassen, Sammelbestellung vorbereiten.",
    nav: [],
  },
  {
    key: "personal", title: "Vorlagen", enforcement: "intern", live: true,
    href: "/personal", group: "buero-personal", icon: "staff",
    hint: "Vorlagen für Büro und Verwaltung, z. B. Auftragsoberfläche (Muster).",
    nav: [],
  },
  {
    key: "auslagen", title: "Auslagen", enforcement: "intern", live: true,
    href: "/auslagen", group: "buero-personal", icon: "receipt",
    hint: "Belege fotografieren, Auslagenanträge stellen, Kreditkarten abgleichen.",
    nav: [
      { label: "Belege", href: "/auslagen", match: ["/auslagen/erfassen", "/auslagen/belege"], icon: "receipt" },
      { label: "Anträge", href: "/auslagen/antraege", match: ["/auslagen/antrag"], icon: "doc-stripe" },
      { label: "Eingang", href: "/auslagen/eingang", finance: true, icon: "doc-stripe" },
      { label: "Profil", href: "/auslagen/profil", icon: "user" },
      { label: "Abgleich", href: "/auslagen/abgleich", finance: true, icon: "card" },
      { label: "Einstellungen", href: "/auslagen/einstellungen", finance: true, icon: "settings" },
    ],
  },
  {
    key: "urlaub", title: "Urlaub", enforcement: "intern", live: false,
    href: "/urlaub", group: "buero-personal", icon: "vacation",
    hint: "Urlaub und Abwesenheit beantragen.",
    nav: [],
  },
  {
    key: "gerda", title: "Gerda", enforcement: "datenbank", live: true,
    href: "/gerda", group: "planung-tools", icon: "report",
    hint: "Aufgaben und Auswertungen, Kennzahlen erfassen und exportieren.",
    nav: [],
  },
  {
    key: "projekte", title: "Projekte", enforcement: "intern", live: false,
    href: "/projekte", group: "planung-tools", icon: "project",
    hint: "Projekte, Aufgaben und Dateien im Team.",
    nav: [],
  },
  {
    key: "pandacad", title: "PandaCAD", enforcement: "intern", live: true,
    href: "/pandacad", group: "planung-tools", icon: "cad",
    hint: "Palette CAD installieren und einrichten.",
    nav: [],
  },
];

/** Unternavigation des Admin-Bereichs (nur CEO/Admin). */
export const ADMIN_NAV: readonly AppNavItem[] = [
  { label: "Mitarbeiter", href: "/admin/mitarbeiter", icon: "user" },
  { label: "Zugänge", href: "/admin/zugaenge", icon: "settings" },
  { label: "Feedback", href: "/admin/feedback", icon: "mail" },
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

export function getApp(key: AppKey): AppDefinition {
  return APPS.find((app) => app.key === key)!;
}

/** Zu einem Pfad gehörende App (längster passender href-Präfix), sonst undefined. */
export function appForPath(pathname: string): AppDefinition | undefined {
  return APPS.filter((app) => pathname === app.href || pathname.startsWith(`${app.href}/`)).sort(
    (a, b) => b.href.length - a.href.length
  )[0];
}

/** Ist ein Nav-Eintrag für den Pfad aktiv? (Tabs der Shell, Admin-Tabs) */
export function isNavItemActive(item: AppNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (!item.exact && pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Freigeschaltete Apps, gruppiert für Startseite und App-Wechsler. */
export function appsByGroup(allowed: readonly AppKey[]) {
  return APP_GROUPS.map((group) => ({
    ...group,
    apps: APPS.filter((app) => app.group === group.key && allowed.includes(app.key)),
  })).filter((group) => group.apps.length > 0);
}
