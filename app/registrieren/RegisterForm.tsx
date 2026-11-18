"use client";

import { useActionState, useState } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { registerAction, type RegisterState } from "./actions";

const field = { display: "flex", flexDirection: "column", gap: 6 } as const;

export function RegisterForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const mismatch = pw2.length > 0 && pw !== pw2;
  const [state, action, isPending] = useActionState<RegisterState, FormData>(registerAction, null);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-raised)",
          border: "1px solid var(--border-strong)",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandMark />
        </div>
        <div style={{ textAlign: "center" }}>
          <span className="grb-eyebrow">Schlutte · Grabner Design</span>
          <h1 className="grb-h-h1" style={{ fontSize: 28, fontWeight: 300, marginTop: 6, letterSpacing: "-0.015em" }}>
            Registrieren
          </h1>
        </div>

        {state?.done ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "var(--font-sans)", fontSize: 15 }}>
            <div style={{ border: "1px solid var(--gd-success)", color: "var(--gd-success)", background: "var(--bg-alt)", padding: "12px 14px" }}>
              ✓ Registrierung eingegangen.
            </div>
            <p style={{ margin: 0, color: "var(--fg-muted)" }}>
              Sobald ein Administrator oder der CEO dein Konto freigegeben hat, kannst du dich mit deinem Namen
              und deinem Passwort anmelden.
            </p>
            <a href="/login" className="grb-btn grb-btn-primary" style={{ textAlign: "center" }}>
              Zur Anmeldung
            </a>
          </div>
        ) : (
          <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {state?.error && (
              <div
                role="alert"
                style={{
                  border: "1.5px solid var(--gd-danger)",
                  color: "var(--gd-danger)",
                  background: "var(--bg-alt)",
                  padding: "12px 14px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                }}
              >
                ❌ {state.error}
              </div>
            )}
            {/* Honeypot: für Menschen unsichtbar */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />

            <label style={field}>
              <span className="grb-eyebrow">Name</span>
              <input name="name" required maxLength={80} className="grb-input" autoComplete="name" placeholder="Vor- und Nachname" />
            </label>
            <label style={field}>
              <span className="grb-eyebrow">Kürzel (1–3 Buchstaben)</span>
              <input
                name="initials"
                required
                maxLength={3}
                pattern="[A-Za-zÄÖÜäöü]{1,3}"
                className="grb-input"
                autoComplete="off"
                placeholder="z. B. MAR"
                style={{ textTransform: "uppercase" }}
              />
            </label>
            <label style={field}>
              <span className="grb-eyebrow">E-Mail (optional)</span>
              <input name="email" type="email" className="grb-input" autoComplete="email" placeholder="name@beispiel.de" />
            </label>
            <label style={field}>
              <span className="grb-eyebrow">Passwort</span>
              <input name="password" type="password" required minLength={8} className="grb-input" autoComplete="new-password" placeholder="Mind. 8 Zeichen" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <p style={{ margin: "-6px 0 0", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
              Bitte gut merken! Dein Passwort kann dir niemand anzeigen, nur ein Administrator kann es neu vergeben.
            </p>
            <label style={field}>
              <span className="grb-eyebrow">Passwort wiederholen</span>
              <input name="password2" type="password" required minLength={8} className="grb-input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              {pw2.length > 0 && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: mismatch ? "var(--gd-danger)" : "var(--gd-success)" }}>
                  {mismatch ? "Die Passwörter stimmen nicht überein." : "✓ Passwörter stimmen überein."}
                </span>
              )}
            </label>

            <button type="submit" className="grb-btn grb-btn-primary" style={{ marginTop: 6 }} disabled={isPending || mismatch}>
              {isPending ? "Wird gesendet …" : "Registrieren"}
            </button>
            <a href="/login" style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-muted)" }}>
              Zurück zur Anmeldung
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
