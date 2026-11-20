"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMeta, holeDokument, speichereDokument, type LokalesDokument } from "./db";
import { SYNC_EVENT } from "./sync";
import type { ProtokollDoc, Vorlage } from "../types";

type Abnahme = Extract<LokalesDokument, { typ: "abnahme" }>;

/**
 * Lokales Protokoll: liest aus IndexedDB, jede Änderung wird sofort zurückgeschrieben
 * (kein „Speichern“-Knopf). Abgeschlossene Protokolle sind gesperrt.
 */
export function useLokalesProtokoll(id: string | null) {
  const [eintrag, setEintrag] = useState<Abnahme | null>(null);
  const [laedt, setLaedt] = useState(true);
  const ref = useRef<Abnahme | null>(null);
  const kette = useRef<Promise<unknown>>(Promise.resolve());

  const neuLaden = useCallback(async () => {
    if (!id) {
      setLaedt(false);
      return;
    }
    const d = await holeDokument(id);
    const a = d && d.typ === "abnahme" ? d : null;
    ref.current = a;
    setEintrag(a);
    setLaedt(false);
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void neuLaden());
    // Sync-Ergebnis (Zustand, rev) von außen übernehmen – nur wenn lokal nichts Neueres steht.
    const onSync = async () => {
      const d = await holeDokument(id ?? "");
      if (d && d.typ === "abnahme" && (!ref.current || d.editSeq >= ref.current.editSeq)) {
        ref.current = d;
        setEintrag(d);
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [id, neuLaden]);

  const aendere = useCallback((fn: (doc: ProtokollDoc) => ProtokollDoc) => {
    const cur = ref.current;
    if (!cur || cur.doc.status === "abgeschlossen") return;
    const next: Abnahme = {
      ...cur,
      doc: fn(cur.doc),
      dirty: true,
      zustand: "lokal",
      fehler: "",
      editSeq: cur.editSeq + 1,
    };
    ref.current = next;
    setEintrag(next);
    kette.current = kette.current.then(() => speichereDokument(next));
  }, []);

  /** Ändert den Eintrag selbst (z. B. Versand-Vormerkung), ohne das Dokument zu sperren. */
  const aendereEintrag = useCallback((fn: (e: Abnahme) => Abnahme) => {
    const cur = ref.current;
    if (!cur) return;
    const next = { ...fn(cur), editSeq: cur.editSeq + 1, dirty: true } as Abnahme;
    ref.current = next;
    setEintrag(next);
    kette.current = kette.current.then(() => speichereDokument(next));
  }, []);

  return { eintrag, doc: eintrag?.doc ?? null, laedt, aendere, aendereEintrag, neuLaden };
}

export async function ladeVorlagenLokal(): Promise<Vorlage[]> {
  return ((await getMeta<Vorlage[]>("vorlagen")) ?? []) as Vorlage[];
}
export async function ladeMitarbeiterLokal(): Promise<{ id: string; name: string }[]> {
  return (await getMeta<{ id: string; name: string }[]>("employees")) ?? [];
}
export async function ladeMe(): Promise<{ id: string | null; name: string } | null> {
  return (await getMeta<{ id: string | null; name: string }>("me")) ?? null;
}
