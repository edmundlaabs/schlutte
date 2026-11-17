import "@/styles/intranet.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";
import { ListTile } from "@/components/intranet/ListTile";
import { getUpcomingEvents, getUpcomingBirthdays } from "@/lib/data/hub";
import { appAccessOf } from "@/lib/auth/app-access";
import { hasAdminRights } from "@/lib/auth/app-role";
import { getCurrentUserContext } from "@/lib/auth/roles";
import { firstNameOf } from "@/lib/auth/provision";
import { listSubmittedClaims, type InboxClaim } from "@/lib/data/auslagen-inbox";
import { appsByGroup, appTitle, isAppKey } from "@/lib/apps";
import { formatEUR } from "@/lib/auslagen/format";
import { formatDate } from "@/lib/utils";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  createBirthdayAction,
  updateBirthdayAction,
  deleteBirthdayAction,
} from "./actions";

export const dynamic = "force-dynamic";

function salutationForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function buildDateLine(now: Date): string {
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const kw = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${days[now.getDay()]} · ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()} · KW ${kw}`;
}

/** Startseite: Begrüßung, freigeschaltete Apps nach Gruppe, Zu erledigen, Termine und Geburtstage. */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ "kein-zugriff"?: string }>;
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const denied = (await searchParams)["kein-zugriff"];
  const allowedApps = appAccessOf(ctx);
  const isAdmin = hasAdminRights(ctx.role);
  const displayName = firstNameOf(ctx.employee?.name || ctx.email?.split("@")[0] || "");

  let inbox: InboxClaim[] = [];
  if (isAdmin) {
    try { inbox = await listSubmittedClaims(); }
    catch (error) { console.error("Antragseingang konnte nicht geladen werden:", error); }
  }
  const [events, birthdays] = await Promise.all([getUpcomingEvents(), getUpcomingBirthdays()]);

  const unreadCount = inbox.filter((claim) => claim.unread).length;
  const groups = appsByGroup(allowedApps);
  const now = new Date();
  const deniedApp = isAppKey(denied) && !allowedApps.includes(denied) ? appTitle(denied) : null;

  return (
    <main className="sch">
      <div className="sch-inner">
        <section className="sch-hero">
          <span className="sch-eyebrow">{buildDateLine(now)}</span>
          <h1 className="sch-greeting">
            {salutationForHour(now.getHours())}
            {displayName ? <>, <em>{displayName}.</em></> : "."}
          </h1>
          <p className="sch-lede">Willkommen in der Schlutte. Wähle einen Bereich.</p>
          {deniedApp && (
            <p role="alert" className="sch-lede sch-alert">
              Kein Zugriff auf „{deniedApp}“ — die App ist für dich nicht freigeschaltet. Bitte an einen Administrator wenden.
            </p>
          )}
        </section>

        <section className="sch-blocks">
          <div className="sch-block" aria-label="Zu erledigen">
            <div className="sch-block-head">
              <div>
                <span className="sch-eyebrow">Auslagen</span>
                <h2>
                  Zu erledigen{" "}
                  {unreadCount > 0 && <span className="sch-notification-dot is-inline" aria-label={`${unreadCount} ungelesen`} />}
                </h2>
              </div>
              {isAdmin && <Link href="/auslagen/eingang">Alle Anträge ansehen →</Link>}
            </div>
            {isAdmin && inbox.length > 0 ? (
              <div className="sch-claims-list">
                {inbox.slice(0, 5).map((claim) => (
                  <Link href={`/auslagen/eingang/${claim.id}`} key={claim.id} className="sch-claim-row">
                    <span className="sch-claim-name">
                      {claim.unread && <span className="sch-notification-dot is-inline" aria-label="Ungelesen" />} {claim.applicantName}
                    </span>
                    <span>{formatDate(claim.sentAt)}</span>
                    <strong>{formatEUR(claim.totalGross)}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="sch-block-empty">
                {isAdmin ? "Noch keine Anträge eingereicht." : "Aktuell ist nichts zu erledigen."}
              </p>
            )}
          </div>

          <div className="sch-block" aria-label="Events">
            <div className="sch-block-head">
              <div>
                <span className="sch-eyebrow">Team</span>
                <h2>Events</h2>
              </div>
            </div>
            <div className="sch-info">
              <ListTile
                bare
                heading="Events"
                items={events}
                isAdmin={isAdmin}
                textLabel="Bezeichnung"
                textPlaceholder="z. B. Sommerfest"
                emptyText="Keine anstehenden Events."
                onCreate={createEventAction}
                onUpdate={updateEventAction}
                onDelete={deleteEventAction}
              />
            </div>
          </div>

          <div className="sch-block" aria-label="Geburtstage">
            <div className="sch-block-head">
              <div>
                <span className="sch-eyebrow">Team</span>
                <h2>Geburtstage</h2>
              </div>
            </div>
            <div className="sch-info">
              <ListTile
                bare
                heading="Geburtstage"
                items={birthdays}
                isAdmin={isAdmin}
                textLabel="Name"
                textPlaceholder="z. B. Max Mustermann"
                emptyText="Keine Geburtstage hinterlegt."
                onCreate={createBirthdayAction}
                onUpdate={updateBirthdayAction}
                onDelete={deleteBirthdayAction}
              />
            </div>
          </div>
        </section>

        <section className="sch-cols" aria-label="Apps">
          {groups.length === 0 && (
            <p className="sch-lede">Für dich ist noch keine App freigeschaltet. Bitte an einen Administrator wenden.</p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="sch-col">
              <h2 className="sch-col-title">{group.title}</h2>
              {group.apps.map((app) => {
                const inner = (
                  <>
                    <span className="sch-app-icon">
                      <AppIcon name={app.icon} size={30} stroke={1.3} />
                      {app.key === "auslagen" && unreadCount > 0 && (
                        <span className="sch-notification-dot" aria-label={`${unreadCount} ungelesene Anträge`} />
                      )}
                    </span>
                    <span className="sch-app-body">
                      <span className="sch-app-title">{app.title}</span>
                      <span className="sch-app-hint">{app.hint}</span>
                    </span>
                    {app.live ? (
                      <span className="sch-app-arrow"><AppIcon name="arrow" size={18} stroke={1.6} /></span>
                    ) : (
                      <span className="sch-app-soon">bald</span>
                    )}
                  </>
                );
                return app.live ? (
                  <Link key={app.key} href={app.href} className="sch-app">{inner}</Link>
                ) : (
                  <div key={app.key} className="sch-app is-soon" aria-disabled="true" title="In Vorbereitung">{inner}</div>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
