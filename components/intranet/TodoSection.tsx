import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { BadgeKey, InboxCounts } from "@/lib/inbox/counts";
import type { AppKey } from "@/lib/apps";

const ITEMS: { key: BadgeKey; title: string; href: string; app?: AppKey }[] = [
  { key: "urlaub", title: "Urlaubsanträge entscheiden", href: "/urlaub/verwaltung", app: "urlaub" },
  { key: "auslagen", title: "Auslagenanträge im Eingang", href: "/auslagen/eingang", app: "auslagen" },
  { key: "feedback", title: "Offenes Feedback", href: "/admin/feedback" },
  { key: "registrierungen", title: "Registrierungen freigeben", href: "/admin/mitarbeiter" },
];

/** „Zu erledigen“ für CEO/Admin: eine Zeile je Quelle mit offenen Vorgängen. Ohne Vorgänge wird nichts angezeigt. */
export function TodoSection({ counts, allowedApps }: { counts: InboxCounts; allowedApps: readonly AppKey[] }) {
  const rows = ITEMS.filter((item) => counts[item.key] > 0 && (!item.app || allowedApps.includes(item.app)));
  if (rows.length === 0) return null;
  return (
    <section className="sch-status" aria-label="Zu erledigen">
      <div className="sch-status-cell">
        <span className="sch-status-title">Zu erledigen</span>
        <ul className="sch-status-list">
          {rows.map((row) => (
            <li key={row.key}>
              <Link href={row.href} className="sch-status-main">
                {row.title}
                <Badge count={counts[row.key]} kind={row.key} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
