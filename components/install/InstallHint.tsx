"use client";

import { useShell } from "@/components/shell/ShellProvider";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dismissHint, isHintDismissed, openInstallSheet, useInstallEnv } from "@/lib/install";
import "@/styles/install.css";

/** Dezenter Streifen unter der Kopfzeile: nur auf dem Handy, nicht installiert, 30 Tage Ruhe nach „×“. */
export function InstallHint() {
  const pathname = usePathname() ?? "/";
  const { device, standalone } = useInstallEnv();
  const { releaseOpen } = useShell();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDismissed(isHintDismissed()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const excluded = pathname === "/login" || pathname.startsWith("/print");
  if (!device || device === "desktop" || standalone || dismissed || excluded || releaseOpen) return null;

  return (
    <div className="install-hint" role="region" aria-label="Schlutte als App">
      <span>Schlutte als App nutzen</span>
      <button type="button" className="install-hint-go" onClick={openInstallSheet}>Einrichten</button>
      <button
        type="button"
        className="install-hint-x"
        aria-label="Hinweis ausblenden"
        onClick={() => {
          dismissHint();
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
