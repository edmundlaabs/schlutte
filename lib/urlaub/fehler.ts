/** Fehler des Urlaub-Moduls: Meldungen sind für Nutzer gedacht (Deutsch), nie rohe DB-Texte. */
export class UrlaubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlaubError";
  }
}

type DbError = { code?: string | null; message?: string | null } | null | undefined;

const MIGRATION = "Das Urlaub-Modul ist in der Datenbank noch nicht eingerichtet (Migration 20261118_urlaub.sql).";

/** Supabase-Fehler → UrlaubError mit deutscher Meldung. Trigger-Meldungen (P0001) werden durchgereicht. */
export function dbFehler(error: DbError, kontext: string): UrlaubError {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202" || msg.toLowerCase().includes("schema cache")) {
    return new UrlaubError(`${kontext}: ${MIGRATION}`);
  }
  if (code === "P0001") return new UrlaubError(msg); // raise exception aus den Triggern
  if (code === "42501") return new UrlaubError(`${kontext}: Keine Berechtigung.`);
  if (code === "23505") return new UrlaubError(`${kontext}: Eintrag existiert bereits.`);
  if (code === "23503") return new UrlaubError(`${kontext}: Verknüpfter Eintrag fehlt oder wird noch verwendet.`);
  if (code === "23514" || code === "23502" || code === "22P02" || code === "22007" || code === "22008") {
    return new UrlaubError(`${kontext}: Ungültige Eingabe.`);
  }
  return new UrlaubError(`${kontext}.${msg ? ` (${msg})` : ""}`);
}

export function fehlerText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Ein unbekannter Fehler ist aufgetreten.";
}
