import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import "@/styles/mobile.css";
import { AppShell } from "@/components/shell/AppShell";
import { appAccessOf } from "@/lib/auth/app-access";
import { hasAdminRights } from "@/lib/auth/app-role";
import { getCurrentUserContext, roleLabel } from "@/lib/auth/roles";
import { getInboxCounts } from "@/lib/data/inbox-counts";
import { getReleasePopup } from "@/lib/data/release-notes";

export const dynamic = "force-dynamic";

/** Gemeinsamer Rahmen: Benutzerdaten und freigeschaltete Apps werden hier serverseitig geladen. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const [counts, release] = await Promise.all([getInboxCounts(), getReleasePopup(ctx.userId)]);
  const initials = ctx.employee?.initials || (ctx.email ? ctx.email.slice(0, 3).toUpperCase() : "USR");
  return (
    <AppShell
      user={{
        name: ctx.employee?.name || ctx.email || "Benutzer",
        initials,
        roleLabel: roleLabel(ctx.role),
        isAdmin: hasAdminRights(ctx.role),
      }}
      allowedApps={appAccessOf(ctx)}
      finance={ctx.isFinance}
      counts={counts}
      release={release}
    >
      {children}
    </AppShell>
  );
}
