import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/auslagen.css";
import "@/styles/abnahme.css";
import "@/styles/abnahme-manuell.css";
import { requireAppAccess } from "@/lib/auth/app-access";
import { AbnahmeSideNav } from "@/components/abnahme/AbnahmeSideNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Abnahme — Schlutte", template: "%s — Abnahme" },
  description: "Abnahmeprotokolle und Regieberichte, auch offline auf dem Tablet.",
};

export default async function AbnahmeLayout({ children }: { children: ReactNode }) {
  // Kopf kommt aus der Shell; die Unternavigation steht ab 768 px als Seitenleiste hier (lib/apps.ts: sideNav).
  const ctx = await requireAppAccess("abnahme");
  return (
    <div className="aus abn abn-frame">
      <AbnahmeSideNav finance={ctx.isFinance} />
      <main className="aus-main abn-main">{children}</main>
    </div>
  );
}
