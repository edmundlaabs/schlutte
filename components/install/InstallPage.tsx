"use client";

import Link from "next/link";
import { InstallGuide } from "@/components/install/InstallGuide";
import { useInstallEnv } from "@/lib/install";
import "@/styles/install.css";

/** Inhalt der öffentlichen Seite /app: gerätespezifische Anleitung und Weg zur Anmeldung. */
export function InstallPage() {
  const { device, standalone, prompt, clearPrompt } = useInstallEnv();
  return (
    <>
      {standalone ? (
        <p className="install-lead">Schlutte ist auf diesem Gerät bereits als App eingerichtet.</p>
      ) : (
        <InstallGuide device={device} prompt={prompt} onInstalled={clearPrompt} />
      )}
      <Link href="/login?next=/" className="install-btn install-btn-primary">Zur Anmeldung</Link>
    </>
  );
}
