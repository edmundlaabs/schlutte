import { badgeLabel, badgeText, type BadgeKey } from "@/lib/inbox/counts";
import "@/styles/badge.css";

/**
 * Roter Punkt mit Zahl (ab 10 „9+“). Bei 0 wird nichts gerendert.
 * `kind` bestimmt den Text für Screenreader; ohne `kind` (Summen) bitte `label` setzen.
 */
export function Badge({
  count,
  kind,
  label,
  className,
}: {
  count: number;
  kind?: BadgeKey;
  label?: string;
  className?: string;
}) {
  if (!count || count < 1) return null;
  const aria = label ?? (kind ? badgeLabel(kind, count) : `${count} offene Vorgänge`);
  return (
    <span className={`ui-badge${className ? ` ${className}` : ""}`} role="img" aria-label={aria}>
      <span aria-hidden="true">{badgeText(count)}</span>
    </span>
  );
}
