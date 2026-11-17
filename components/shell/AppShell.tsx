import type { ReactNode } from "react";
import { ShellHeader, type ShellUser } from "@/components/shell/ShellHeader";
import { SubNav } from "@/components/shell/SubNav";
import { appsByGroup, type AppKey } from "@/lib/apps";
import "@/styles/shell.css";

/**
 * Gemeinsamer Rahmen aller Seiten: Zeile 1 (Logo, App-Wechsler, Breadcrumb, Feedback, Avatar-Menü),
 * Zeile 2 (Tabs der aktuellen App), mobil Tab-Leiste unten.
 * Benutzerdaten kommen serverseitig vom Layout; hier nur Darstellung.
 */
export function AppShell({
  user,
  allowedApps,
  finance,
  children,
}: {
  user: ShellUser;
  allowedApps: readonly AppKey[];
  finance: boolean;
  children: ReactNode;
}) {
  const groups = appsByGroup(allowedApps).map((group) => ({
    key: group.key,
    title: group.title,
    apps: group.apps.map((app) => ({
      key: app.key,
      title: app.title,
      href: app.href,
      live: app.live,
      icon: app.icon,
    })),
  }));

  return (
    <div className="grb shell">
      <ShellHeader user={user} groups={groups} />
      <SubNav variant="top" finance={finance} isAdmin={user.isAdmin} />
      <div className="shell-content">{children}</div>
      <SubNav variant="tabs" finance={finance} isAdmin={user.isAdmin} />
    </div>
  );
}
