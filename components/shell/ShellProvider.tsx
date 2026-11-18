"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EMPTY_INBOX_COUNTS, mapInboxCounts, type InboxCounts } from "@/lib/inbox/counts";

type ShellState = {
  /** Offene Eingänge für die roten Punkte (nur CEO/Admin ungleich 0). */
  counts: InboxCounts;
  /** Release-Popup ist offen: andere Hinweise (Install) warten. */
  releaseOpen: boolean;
  setReleaseOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState>({
  counts: EMPTY_INBOX_COUNTS,
  releaseOpen: false,
  setReleaseOpen: () => {},
});

export const useShell = () => useContext(ShellContext);

const POLL_MS = 60_000;

/**
 * Hält die Zähler der roten Punkte. Startwert kommt serverseitig vom Layout (und ändert sich bei
 * router.refresh / revalidatePath); zusätzlich Polling alle 60 s, solange das Fenster sichtbar ist.
 * Polling statt Realtime: ein Zähler über vier Tabellen, keine Publication-/RLS-Einrichtung nötig.
 */
export function ShellProvider({
  initialCounts,
  poll,
  children,
}: {
  initialCounts: InboxCounts;
  poll: boolean;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const initialKey = JSON.stringify(initialCounts);
  const [seenKey, setSeenKey] = useState(initialKey);
  // Neuer Serverwert (router.refresh / revalidatePath) ersetzt den lokalen Stand.
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setCounts(initialCounts);
  }

  useEffect(() => {
    if (!poll) return;
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/inbox-counts", { cache: "no-store" });
        if (res.ok && !stopped) setCounts(mapInboxCounts(await res.json()));
      } catch {
        /* offline: alten Stand behalten */
      }
    };
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const value = useMemo(() => ({ counts, releaseOpen, setReleaseOpen }), [counts, releaseOpen]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
