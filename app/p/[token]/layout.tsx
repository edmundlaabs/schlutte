import type { Metadata, Viewport } from "next";

/** Öffentliche Protokollseite: kein Schlutte-Header, keine Navigation, nicht indexierbar, kein Referrer. */
export const metadata: Metadata = {
  title: "Abnahmeprotokoll",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  manifest: null,
  appleWebApp: { capable: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F4" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A18" },
  ],
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
