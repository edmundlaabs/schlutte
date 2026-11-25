import type { ProtokollDoc } from "./types.ts";

/** Archivierte Stände eines Protokolls (Tabelle abnahme_staende), wie sie der Sync mitschickt. */
export type StandArchiv = { tablet: ProtokollDoc; server: ProtokollDoc };
