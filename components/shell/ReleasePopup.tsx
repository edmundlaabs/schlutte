"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShell } from "@/components/shell/ShellProvider";
import { markReleaseSeenAction } from "@/app/(app)/release-actions";
import type { ReleasePopupData } from "@/lib/data/release-notes";
import "@/styles/release.css";

const EXCLUDED = ["/app", "/login", "/registrieren", "/passwort-", "/print"];

function isExcluded(pathname: string): boolean {
  return EXCLUDED.some((p) => (p === "/app" ? pathname === p || pathname.startsWith("/app/") : pathname.startsWith(p)));
}

/** „Was ist neu“ nach einem Versionswechsel. Einmal pro Version, Stand liegt in der Datenbank. */
export function ReleasePopup({ data, isAdmin }: { data: ReleasePopupData; isAdmin: boolean }) {
  const pathname = usePathname() ?? "/";
  const { setReleaseOpen } = useShell();
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const visible = !dismissed && !isExcluded(pathname);

  const close = useCallback(() => {
    setDismissed(true); // optimistisch
    void markReleaseSeenAction();
  }, []);

  useEffect(() => {
    setReleaseOpen(visible);
    return () => setReleaseOpen(false);
  }, [visible, setReleaseOpen]);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.querySelector<HTMLElement>(".release-primary")?.focus();
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
      previousFocus?.focus?.();
    };
  }, [visible, close]);

  if (!visible) return null;

  return createPortal(
    <div className="release-backdrop" onClick={close}>
      <div
        ref={dialogRef}
        className="release-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="release-head">
          <div>
            <span className="release-kicker">Version {data.version}</span>
            <h2 id="release-title">{data.popupTitle ?? "Was ist neu"}</h2>
          </div>
          <button type="button" className="release-close" aria-label="Schließen" onClick={close}>×</button>
        </div>
        <div className="release-body">
          {data.popupIntro && <p className="release-intro">{data.popupIntro}</p>}
          <ul className="release-list">
            {data.highlights.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
          {isAdmin && data.adminHighlights && (
            <section className="release-admin" aria-label="Für Admin/CEO">
              <h3>Für Admin/CEO</h3>
              <p>{data.adminHighlights}</p>
            </section>
          )}
        </div>
        <div className="release-foot">
          <Link href="/feedback" className="release-link" onClick={close}>Alle Änderungen ansehen</Link>
          <button type="button" className="release-primary" onClick={close}>Verstanden</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
