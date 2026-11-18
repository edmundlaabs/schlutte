"use client";

import { useRef, type ReactNode } from "react";
import type { UrlaubResult } from "@/app/(app)/urlaub/actions";
import { Meldung, useAktion } from "./useAktion";

/** Kleines Formular, das eine Server Action aufruft und das Ergebnis anzeigt. */
export function AktionsForm({
  action,
  children,
  label,
  zuruecksetzen = true,
  className = "urlaub-inline-form",
}: {
  action: (formData: FormData) => Promise<UrlaubResult>;
  children: ReactNode;
  label: string;
  zuruecksetzen?: boolean;
  className?: string;
}) {
  const { pending, result, ausfuehren } = useAktion();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        ausfuehren(() => action(fd), () => { if (zuruecksetzen) ref.current?.reset(); });
      }}
    >
      {children}
      <button type="submit" className="aus-btn aus-btn-secondary aus-btn-sm" disabled={pending}>{pending ? "…" : label}</button>
      <div style={{ flexBasis: "100%" }}><Meldung result={result} /></div>
    </form>
  );
}

export function LoeschButton({ action, text }: { action: () => Promise<UrlaubResult>; text: string }) {
  const { pending, result, ausfuehren } = useAktion();
  return (
    <>
      <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm" disabled={pending}
        onClick={() => { if (confirm(text)) ausfuehren(action); }}>Löschen</button>
      <Meldung result={result} />
    </>
  );
}
