"use client";

import type { LokalesDokument } from "@/lib/abnahme/offline/db";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

/** Platzhalter bis Schritt 5/6: PDF ansehen/herunterladen, Senden, Nachtrag. */
export function AblageAktionen(_props: { eintrag: Abnahme; online: boolean; onAendereEintrag: (fn: (e: Abnahme) => Abnahme) => void }) {
  void _props;
  return null;
}
