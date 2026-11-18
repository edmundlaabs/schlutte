import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";
import { compareSemver } from "@/lib/utils";

export type ReleasePopupData = Pick<ChangelogEntry, "version" | "popupTitle" | "popupIntro" | "adminHighlights"> & {
  highlights: NonNullable<ChangelogEntry["highlights"]>;
};

/**
 * Entscheidet serverseitig, ob das Release-Popup erscheint.
 * Fehlt die Spalte (Migration noch nicht gelaufen) oder schlägt die Abfrage fehl: kein Popup.
 * Hat der Changelog-Eintrag keine highlights: still auf die neue Version setzen.
 */
export async function getReleasePopup(userId: string): Promise<ReleasePopupData | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.from("employees").select("last_seen_version").eq("id", userId).maybeSingle();
    if (error || !data) return null;
    if (compareSemver(data.last_seen_version as string | null, APP_VERSION) >= 0) return null;
    const entry = CHANGELOG.find((e) => e.version === APP_VERSION);
    if (!entry?.highlights?.length) {
      await db.rpc("mark_release_seen", { version: APP_VERSION });
      return null;
    }
    return {
      version: entry.version,
      popupTitle: entry.popupTitle,
      popupIntro: entry.popupIntro,
      adminHighlights: entry.adminHighlights,
      highlights: entry.highlights,
    };
  } catch (error) {
    console.error("Release-Hinweis konnte nicht geprüft werden:", error);
    return null;
  }
}
