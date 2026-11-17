"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";
import { completePasswordResetAction, type PasswordResetState } from "./actions";

type Phase = "checking" | "ready" | "invalid";

/**
 * Ziel des Recovery-Links aus der E-Mail. Unterstützt beide Supabase-Varianten:
 *  - ?token_hash=…&type=recovery (angepasste E-Mail-Vorlage, geräteunabhängig)
 *  - ?code=… (Standard-PKCE-Link; der Browser-Client tauscht den Code beim Laden ein)
 */
export default function PasswortNeuPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [state, action, isPending] = useActionState<PasswordResetState, FormData>(
    completePasswordResetAction,
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
      let ok = false;
      try {
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          ok = !error;
        } else {
          // getSession wartet auf die Initialisierung inkl. Einlösen von ?code=…
          const { data } = await supabase.auth.getSession();
          ok = !!data.session;
        }
      } catch {
        ok = false;
      }
      if (!cancelled) setPhase(ok ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const box = (color: string): React.CSSProperties => ({
    border: `1.5px solid ${color}`,
    color,
    background: "var(--bg-alt)",
    padding: "12px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    lineHeight: 1.5,
  });

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
          gap: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandMark />
        </div>

        <div style={{ textAlign: "center" }}>
          <span className="grb-eyebrow">Schlutte · Grabner Design</span>
          <h1
            className="grb-h-h1"
            style={{ fontSize: 28, fontWeight: 300, marginTop: 6, letterSpacing: "-0.015em" }}
          >
            Neues Passwort
          </h1>
        </div>

        {phase === "checking" && (
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--fg-muted)", textAlign: "center" }}>
            Link wird geprüft …
          </p>
        )}

        {phase === "invalid" && (
          <>
            <div role="alert" style={box("var(--gd-danger)")}>
              Der Link ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern und im
              selben Browser öffnen, in dem er angefordert wurde.
            </div>
            <a href="/passwort-vergessen" className="grb-btn grb-btn-primary" style={{ justifyContent: "center" }}>
              Neuen Link anfordern
            </a>
          </>
        )}

        {phase === "ready" && state?.success && (
          <>
            <div role="status" style={box("var(--gd-success)")}>
              Das Passwort wurde geändert. Es gilt für die Schlutte und alle für dich
              freigeschalteten Apps.
            </div>
            <Link href="/" className="grb-btn grb-btn-primary" style={{ justifyContent: "center" }}>
              Weiter zum Intranet
            </Link>
          </>
        )}

        {phase === "ready" && !state?.success && (
          <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {state?.error && (
              <div role="alert" style={box("var(--gd-danger)")}>
                {state.error}
              </div>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="grb-eyebrow">Neues Passwort</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="grb-input"
                placeholder="Mind. 8 Zeichen"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="grb-eyebrow">Passwort wiederholen</span>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="grb-input"
              />
            </label>
            <button type="submit" className="grb-btn grb-btn-primary" disabled={isPending}>
              {isPending ? "Wird gespeichert …" : "Passwort speichern"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
