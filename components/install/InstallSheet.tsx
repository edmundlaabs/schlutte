"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InstallGuide } from "@/components/install/InstallGuide";
import { INSTALL_EVENT, useInstallEnv } from "@/lib/install";
import "@/styles/install.css";

/**
 * Sheet „Schlutte aufs Handy“. Liegt einmal in der AppShell und wird per Ereignis geöffnet
 * (Menüpunkt „Als App“, Hinweis-Streifen). Mobil als Bottom-Sheet, am Desktop als zentrierte Karte.
 */
export function InstallSheet() {
  const { device, prompt, clearPrompt } = useInstallEnv();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onOpen = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(INSTALL_EVENT, onOpen);
    return () => window.removeEventListener(INSTALL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    <div className="install-backdrop" onClick={close}>
      <div
        ref={dialogRef}
        className="install-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="install-head">
          <div>
            <span className="install-kicker">Schlutte</span>
            <h2 id="install-title">Schlutte aufs Handy</h2>
          </div>
          <button type="button" className="install-close" aria-label="Schließen" onClick={close}>×</button>
        </div>
        <InstallGuide
          device={device}
          prompt={prompt}
          onInstalled={() => {
            clearPrompt();
            close();
          }}
        />
      </div>
    </div>,
    document.body
  );
}
