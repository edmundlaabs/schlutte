"use client";

import { openInstallSheet, useInstallEnv } from "@/lib/install";

/** Menüpunkt „Als App“ im Avatar-Menü. Öffnet das Sheet (liegt in der AppShell); in der installierten App ausgeblendet. */
export function InstallAppButton({ onOpen }: { onOpen?: () => void }) {
  const { standalone } = useInstallEnv();
  if (standalone) return null;
  return (
    <button
      type="button"
      role="menuitem"
      className="shell-menu-item"
      onClick={() => {
        onOpen?.();
        openInstallSheet();
      }}
    >
      Als App
    </button>
  );
}
