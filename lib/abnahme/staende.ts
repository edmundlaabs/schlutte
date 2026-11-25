import type { ProtokollDoc, RegieDoc } from "./types.ts";

/** Archivierte Stände eines Protokolls (Tabelle abnahme_staende), wie sie der Sync mitschickt. */
export type StandArchiv = { tablet: ProtokollDoc; server: ProtokollDoc };

/** Wie StandArchiv, für Regieberichte (Tabelle abnahme_regie_staende). */
export type RegieStandArchiv = { tablet: RegieDoc; server: RegieDoc };
