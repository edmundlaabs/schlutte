"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APPS, isNavItemActive } from "@/lib/apps";

/**
 * Seitenleiste der Abnahme (Design „Dokument“): g-Signet, nummerierte Unternavigation.
 * Ab 768 px sichtbar (ersetzt dort die Tab-Zeile der Shell); in der Begehung und unter 1100 px
 * schmal als Leiste mit Nummern. Mobil bleibt die Tab-Leiste der Shell unten.
 */
export function AbnahmeSideNav({ finance }: { finance: boolean }) {
  const pathname = usePathname() ?? "/abnahme";
  const app = APPS.find((a) => a.key === "abnahme");
  const items = (app?.nav ?? []).filter((i) => !i.finance || finance);
  const schmal = pathname.startsWith("/abnahme/begehung");

  return (
    <aside className={`abn-side${schmal ? " is-rail" : ""}`} aria-label="Abnahme">
      <Link href="/abnahme" className="abn-side-brand" aria-label="Abnahme – Ablage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/grabner-g.svg" alt="" width={40} height={40} className="abn-side-g" />
        <span className="abn-side-title">
          <span className="abn-side-kicker">Schlutte</span>
          <span>Abnahme</span>
        </span>
      </Link>
      <nav className="abn-side-nav">
        {items.map((item, i) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <span className="abn-side-nr">{String(i + 1).padStart(2, "0")}</span>
              <span className="abn-side-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
