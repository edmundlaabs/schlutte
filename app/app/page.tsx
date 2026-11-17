import type { Metadata } from "next";
import { InstallPage } from "@/components/install/InstallPage";
import "@/styles/install.css";

export const metadata: Metadata = { title: "Schlutte aufs Handy" };

/** Öffentliche Einrichtungsseite (Ziel des QR-Codes): ohne Anmeldung, ohne Shell. */
export default function AppSetupPage() {
  return (
    <main className="install-page">
      <div className="install-page-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/grabner-schlutte-logo.svg" alt="Grabner Schlutte" className="install-page-logo" />
        <span className="install-kicker">Einrichten</span>
        <h1>Schlutte aufs Handy</h1>
        <InstallPage />
      </div>
    </main>
  );
}
