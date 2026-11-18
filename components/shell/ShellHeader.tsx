"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import { AppIcon } from "@/components/ui/AppIcon";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useShell } from "@/components/shell/ShellProvider";
import { APP_BADGE, sumCounts } from "@/lib/inbox/counts";
import { InstallAppButton } from "@/components/shell/InstallAppButton";
import { appForPath, type AppIconName } from "@/lib/apps";
import { createClient } from "@/lib/supabase/client";

export type ShellApp = { key: string; title: string; href: string; live: boolean; icon: AppIconName };
export type ShellAppGroup = { key: string; title: string; apps: ShellApp[] };
export type ShellUser = { name: string; initials: string; roleLabel: string; isAdmin: boolean };

/** Name des aktuellen Bereichs für den Breadcrumb (null = Startseite). */
function sectionName(pathname: string): string | null {
  if (pathname === "/") return null;
  const app = appForPath(pathname);
  if (app) return app.title;
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname.startsWith("/feedback")) return "Feedback";
  if (pathname.startsWith("/konto")) return "Mein Konto";
  return null;
}

export function ShellHeader({ user, groups }: { user: ShellUser; groups: ShellAppGroup[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { counts } = useShell();
  const adminSum = sumCounts(counts, ["feedback", "registrierungen"]);
  const [open, setOpen] = useState<"apps" | "user" | null>(null);
  const [dark, setDark] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const section = sectionName(pathname);
  const current = appForPath(pathname);

  // Menüs bei Navigation, Klick außerhalb und Escape schließen.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(null));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setDark(document.documentElement.getAttribute("data-theme") === "dark")
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  };

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="shell-top" ref={rootRef}>
      <Link href="/" className="shell-brand" aria-label="Zur Startseite">
        <BrandMark />
      </Link>

      <div className="shell-pop">
        <button
          type="button"
          className={`shell-switch${open === "apps" ? " is-open" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open === "apps"}
          onClick={() => setOpen(open === "apps" ? null : "apps")}
        >
          <Icon name="grid" size={16} />
          <span className="shell-switch-label">Apps</span>
          <Icon name="chevron-down" size={14} />
        </button>
        {open === "apps" && (
          <div className="shell-menu shell-menu-apps" role="menu">
            <Link href="/" role="menuitem" className="shell-menu-item">
              <Icon name="home" size={18} />
              <span>Startseite</span>
            </Link>
            {groups.map((group) => (
              <div key={group.key} className="shell-menu-group">
                <span className="shell-menu-eyebrow">{group.title}</span>
                {group.apps.map((app) =>
                  app.live ? (
                    <Link
                      key={app.key}
                      href={app.href}
                      role="menuitem"
                      className={`shell-menu-item${current?.key === app.key ? " is-current" : ""}`}
                    >
                      <AppIcon name={app.icon} size={18} stroke={1.5} />
                      <span>{app.title}</span>
                      {APP_BADGE[app.key] && <Badge count={counts[APP_BADGE[app.key]!]} kind={APP_BADGE[app.key]} />}
                    </Link>
                  ) : (
                    <span key={app.key} className="shell-menu-item is-disabled" aria-disabled="true">
                      <AppIcon name={app.icon} size={18} stroke={1.5} />
                      <span>{app.title}</span>
                      <em>bald</em>
                    </span>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="shell-crumb" aria-label="Breadcrumb">
        {section ? (
          <>
            <Link href="/">Start</Link>
            <span aria-hidden="true">/</span>
            <strong aria-current="page">{section}</strong>
          </>
        ) : (
          <strong aria-current="page">Start</strong>
        )}
      </nav>

      <div className="shell-right">
        <Link href="/feedback" className="shell-iconbtn" aria-label="Feedback" title="Feedback an Eddy">
          <Icon name="mail" size={18} />
        </Link>
        <div className="shell-pop">
          <button
            type="button"
            className="shell-avatar"
            aria-haspopup="menu"
            aria-expanded={open === "user"}
            aria-label={`Konto von ${user.name}`}
            onClick={() => setOpen(open === "user" ? null : "user")}
          >
            {user.initials}
            {user.isAdmin && <Badge count={adminSum} label={`${adminSum} offene Vorgänge im Admin-Bereich`} className="shell-avatar-badge" />}
          </button>
          {open === "user" && (
            <div className="shell-menu shell-menu-user" role="menu">
              <div className="shell-menu-who">
                <strong>{user.name}</strong>
                <span>{user.roleLabel} · {user.initials}</span>
              </div>
              <Link href="/konto" role="menuitem" className="shell-menu-item">Mein Konto</Link>
              <Link href="/passwort-neu" role="menuitem" className="shell-menu-item">Passwort ändern</Link>
              {user.isAdmin && (
                <>
                  <Link href="/admin/mitarbeiter" role="menuitem" className="shell-menu-item">
                    Mitarbeiterverwaltung
                    <Badge count={counts.registrierungen} kind="registrierungen" />
                  </Link>
                  <Link href="/admin/zugaenge" role="menuitem" className="shell-menu-item">Zugänge</Link>
                  <Link href="/admin/feedback" role="menuitem" className="shell-menu-item">
                    Feedback
                    <Badge count={counts.feedback} kind="feedback" />
                  </Link>
                </>
              )}
              <button type="button" role="menuitem" className="shell-menu-item" onClick={toggleTheme}>
                {dark ? "Helles Design" : "Dunkles Design"}
              </button>
              <InstallAppButton onOpen={() => setOpen(null)} />
              <button type="button" role="menuitem" className="shell-menu-item is-danger" onClick={logout}>
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
