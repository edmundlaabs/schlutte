"use client";

import { useState, useTransition } from "react";
import type { UrlaubResult } from "@/app/(app)/urlaub/actions";

/** Führt eine Server Action aus und merkt sich Wartezustand und Ergebnis für die Anzeige. */
export function useAktion() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<UrlaubResult | null>(null);

  function ausfuehren(fn: () => Promise<UrlaubResult>, beiErfolg?: () => void) {
    setResult(null);
    start(async () => {
      let r: UrlaubResult;
      try {
        r = await fn();
      } catch {
        r = { ok: false, error: "Die Aktion konnte nicht ausgeführt werden. Bitte Verbindung prüfen und erneut versuchen." };
      }
      setResult(r);
      if (r.ok) beiErfolg?.();
    });
  }
  return { pending, result, ausfuehren, setResult };
}

export function Meldung({ result }: { result: UrlaubResult | null }) {
  if (!result) return null;
  if (result.ok) return result.message ? <p className="urlaub-meldung is-ok" role="status">{result.message}</p> : null;
  return <p className="urlaub-meldung is-fehler" role="alert">{result.error}</p>;
}
