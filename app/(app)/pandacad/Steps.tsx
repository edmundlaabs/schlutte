"use client";

import { useState, useSyncExternalStore } from "react";

export type Step = {
  title: string;
  body: string[];
  /** Netzwerkpfad mit Kopier-Button. */
  path?: string;
  /** Platzhalter: Inhalt folgt (steht nicht als fertige Anleitung da). */
  placeholder?: string;
};

const KEY = "pandacad-steps-v1";

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch", margin: "10px 0", flexWrap: "wrap" }}>
      <code style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" }}>
        {path}
      </code>
      <button
        type="button"
        className="grb-btn grb-btn-quiet"
        style={{ padding: "8px 14px" }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(path);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Pfad kopieren:", path);
          }
        }}
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readRaw(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function Steps({ steps }: { steps: Step[] }) {
  // Fortschritt nur lokal im Browser (localStorage); Server rendert ohne Haken.
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const done = steps.map((_, i) => {
    try { return JSON.parse(raw || "[]")[i] === true; } catch { return false; }
  });

  const toggle = (i: number) => {
    const next = done.map((d, j) => (j === i ? !d : d));
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignorieren */ }
    listeners.forEach((l) => l());
  };

  const count = done.filter(Boolean).length;

  return (
    <div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
        {count} von {steps.length} Schritten erledigt (nur in diesem Browser gespeichert)
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 14 }}>
        {steps.map((s, i) => (
          <li
            key={s.title}
            style={{
              border: "1px solid var(--border-strong)",
              padding: "18px 22px",
              opacity: done[i] ? 0.6 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", marginRight: 10 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </h3>
              <label style={{ fontSize: 13, display: "inline-flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} />
                erledigt
              </label>
            </div>
            {s.body.map((line) => (
              <p key={line} style={{ fontSize: 14, color: "var(--fg-muted)", margin: "8px 0 0" }}>{line}</p>
            ))}
            {s.path && <CopyPath path={s.path} />}
            {s.placeholder && (
              <p style={{ marginTop: 10, padding: "8px 12px", border: "1px dashed var(--border-strong)", fontSize: 13 }}>
                {s.placeholder}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
