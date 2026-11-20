import type { RegieDoc } from "../types";

/** Platzhalter bis Schritt 7 (Regiebericht). */
export async function speichereRegieAusServer(_res: unknown): Promise<void> {
  void _res;
  throw new Error("Regiebericht folgt.");
}
export function regiePfadeSetzen(doc: RegieDoc, _gesetzt: Map<string, string>): RegieDoc {
  void _gesetzt;
  return doc;
}
