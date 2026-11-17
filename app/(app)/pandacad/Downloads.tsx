"use client";

import { useState, useTransition } from "react";
import { getPandaCadDownloadUrl } from "./actions";

export type DownloadItem = { id: string; titel: string; beschreibung: string | null };

export function Downloads({ items }: { items: DownloadItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>Noch keine Dateien hinterlegt.</p>;
  }

  const download = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await getPandaCadDownloadUrl(id);
      if (res.error || !res.url) setError(res.error ?? "Download fehlgeschlagen.");
      else window.location.assign(res.url);
    });
  };

  return (
    <div>
      {error && <p role="alert" style={{ color: "var(--accent)", fontSize: 13 }}>{error}</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((d) => (
          <li
            key={d.id}
            style={{
              display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center",
              padding: "12px 0", borderBottom: "1px solid var(--border)",
            }}
          >
            <span>
              <strong style={{ fontWeight: 500 }}>{d.titel}</strong>
              {d.beschreibung && (
                <span style={{ display: "block", fontSize: 13, color: "var(--fg-muted)" }}>{d.beschreibung}</span>
              )}
            </span>
            <button type="button" className="grb-btn grb-btn-quiet" disabled={pending} onClick={() => download(d.id)}>
              Herunterladen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
