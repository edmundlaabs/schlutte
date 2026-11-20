import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/auslagen.css";
import "@/styles/abnahme.css";
import { requireAppAccess } from "@/lib/auth/app-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Abnahme — Schlutte", template: "%s — Abnahme" },
  description: "Abnahmeprotokolle und Regieberichte, auch offline auf dem Tablet.",
};

export default async function AbnahmeLayout({ children }: { children: ReactNode }) {
  // Kopf und Tabs kommen aus der Shell; hier nur der Zugriffsschutz.
  await requireAppAccess("abnahme");
  return (
    <div className="aus abn">
      <main className="aus-main">{children}</main>
    </div>
  );
}
