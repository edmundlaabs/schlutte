"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { ADMIN_NAV, appForPath, isNavItemActive, type AppNavItem } from "@/lib/apps";

/** Unternavigation des aktuellen Bereichs: Tabs oben (ab 768 px) bzw. Tab-Leiste unten (mobil). */
export function SubNav({
  variant,
  finance,
  isAdmin,
}: {
  variant: "top" | "tabs";
  finance: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname() ?? "/";
  let items: readonly AppNavItem[] = [];
  let label = "Bereich";
  if (pathname.startsWith("/admin")) {
    if (isAdmin) {
      items = ADMIN_NAV;
      label = "Admin";
    }
  } else {
    const app = appForPath(pathname);
    if (app) {
      items = app.nav;
      label = app.title;
    }
  }
  const visible = items.filter((item) => !item.finance || finance);
  if (visible.length === 0) return null;

  if (variant === "top") {
    return (
      <nav className="shell-sub" aria-label={label}>
        {visible.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="shell-tabbar" aria-label={label}>
      {visible.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "shell-tab is-active" : "shell-tab"}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon ?? "list"} size={22} stroke={1.5} />
            <span className="shell-tab-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
