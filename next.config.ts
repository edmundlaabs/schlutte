import type { NextConfig } from "next";

/**
 * Alte URLs (vor der Navigations-Umstellung) leiten dauerhaft auf die neuen Pfade weiter.
 * Reihenfolge beachten: spezifischere Regeln vor allgemeineren.
 */
const nextConfig: NextConfig = {
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
