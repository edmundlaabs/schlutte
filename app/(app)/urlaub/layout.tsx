import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/auslagen.css";
import "@/styles/urlaub.css";
import { requireAppAccess } from "@/lib/auth/app-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Urlaub — Schlutte", template: "%s — Urlaub" },
  description: "Urlaub und Abwesenheit beantragen, Urlaubskonto und Kalender.",
};

export default async function UrlaubLayout({ children }: { children: ReactNode }) {
  // Kopf und Tabs kommen aus der Shell; hier nur der Zugriffsschutz.
  await requireAppAccess("urlaub");
  return (
    <div className="aus urlaub">
      <main className="aus-main">{children}</main>
    </div>
  );
}
