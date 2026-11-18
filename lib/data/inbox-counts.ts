import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/roles";
import { EMPTY_INBOX_COUNTS, mapInboxCounts, type InboxCounts } from "@/lib/inbox/counts";

/**
 * Offene Eingänge für die roten Punkte. Nur CEO/Admin, sonst alles 0 ohne Query.
 * Zählt über die Postgres-Function inbox_counts() (security definer, prüft die Rolle selbst).
 */
export const getInboxCounts = cache(async (): Promise<InboxCounts> => {
  const ctx = await getCurrentUserContext();
  if (!ctx?.isFinance) return EMPTY_INBOX_COUNTS;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("inbox_counts");
    if (error) throw error;
    return mapInboxCounts(data);
  } catch (error) {
    console.error("Eingangszähler konnten nicht geladen werden:", error);
    return EMPTY_INBOX_COUNTS;
  }
});
