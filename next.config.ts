import type { NextConfig } from "next";

/**
 * Alte URLs (vor der Navigations-Umstellung) leiten dauerhaft auf die neuen Pfade weiter.
 * Reihenfolge beachten: spezifischere Regeln vor allgemeineren.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Öffentliche Protokollseite (/p/<token>): nicht indexieren, kein Referrer, nicht cachen.
        source: "/p/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Service Worker nur für das Modul /abnahme: Scope-Freigabe, nie aus dem HTTP-Cache.
        source: "/sw-abnahme.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/abnahme/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/start", destination: "/", permanent: true },
      { source: "/kommissionen", destination: "/werkstatt/kommissionen", permanent: true },
      { source: "/kommissionen/:path*", destination: "/werkstatt/kommissionen/:path*", permanent: true },
      { source: "/archiv", destination: "/werkstatt/archiv", permanent: true },
      { source: "/archiv/:path*", destination: "/werkstatt/archiv/:path*", permanent: true },
      { source: "/dokument-erstellen/:path*", destination: "/werkstatt/dokument-erstellen/:path*", permanent: true },
      { source: "/mitarbeiter/zugaenge", destination: "/admin/zugaenge", permanent: true },
      { source: "/mitarbeiter", destination: "/admin/mitarbeiter", permanent: true },
      { source: "/mitarbeiter/:path*", destination: "/admin/mitarbeiter/:path*", permanent: true },
      { source: "/vorlagen", destination: "/werkstatt", permanent: true },
    ];
  },
};

export default nextConfig;
