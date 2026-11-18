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
import { getInboxCounts } from "@/lib/data/inbox-counts";
import { Badge } from "@/components/ui/Badge";
import { APP_BADGE } from "@/lib/inbox/counts";
import { TodoSection } from "@/components/intranet/TodoSection";
import { appsByGroup, appTitle, getApp, isAppKey } from "@/lib/apps";
import { ladeStartWidget } from "@/lib/data/urlaub";
import { StatusKachel } from "@/components/intranet/StatusKachel";
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

  const counts = await getInboxCounts();
  const [events, birthdays] = await Promise.all([getUpcomingEvents(), getUpcomingBirthdays()]);
  // Urlaub-Zelle der Status-Kachel: nur mit Freischaltung, Mitarbeiter-Eintrag und sobald das Modul live ist.
  const urlaubWidget =
    getApp("urlaub").live && allowedApps.includes("urlaub") && ctx.employee?.id
      ? await ladeStartWidget(ctx.employee.id, isAdmin)
      : null;

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

        <StatusKachel
          birthdays={birthdays}
          events={events}
          auslagen={allowedApps.includes("auslagen") ? { isAdmin, offen: counts.auslagen } : null}
          urlaub={urlaubWidget}
          urlaubOffen={counts.urlaub}
        />

        {isAdmin && <TodoSection counts={counts} allowedApps={allowedApps} />}

        {isAdmin && (
          <details className="sch-edit">
            <summary>Events und Geburtstage bearbeiten</summary>
            <div className="sch-edit-body">
              <ListTile
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
              <ListTile
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
          </details>
        )}

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
                      {APP_BADGE[app.key] && <Badge count={counts[APP_BADGE[app.key]!]} kind={APP_BADGE[app.key]} />}
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
