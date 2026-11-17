import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/auslagen.css";
import { requireAppAccess } from "@/lib/auth/app-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Belege — Schlutte", template: "%s — Belege" },
  description: "Quittungen und Rechnungen erfassen, Auslagen erstatten lassen, Kreditkarten abgleichen.",
  manifest: "/schlutte.webmanifest",
  appleWebApp: { capable: true, title: "Schlutte", statusBarStyle: "default" },
  icons: {
    apple: [{ url: "/icons/schlutte-180.png", sizes: "180x180", type: "image/png" }],
  },
  // Next rendert für capable nur "mobile-web-app-capable"; ältere iOS-Versionen lesen das Apple-Tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F4" },
    { media: "(prefers-color-scheme: dark)", color: "#2A2926" },
  ],
  viewportFit: "cover",
};

export default async function AuslagenLayout({ children }: { children: ReactNode }) {
  // Kopf und Navigation (Tabs) kommen aus der Shell; hier nur der Zugriffsschutz.
  await requireAppAccess("auslagen");
  return (
    <div className="aus">
      <main className="aus-main">{children}</main>
    </div>
  );
}
