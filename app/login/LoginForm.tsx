"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";
import { loginRedirectTarget } from "@/lib/auth/next-path";
import { loginWithEmployee } from "./actions";

export function LoginForm({ choices }: { choices: { id: string; name: string }[] }) {
  const supabase = createClient();

  const [mode, setMode] = useState<"name" | "email">(choices.length > 0 ? "name" : "email");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      let error: { message: string } | null = null;
      if (mode === "name") {
        const res = await loginWithEmployee(employeeId, password);
        if (res.error) error = { message: res.error };
      } else {
        const res = await supabase.auth.signInWithPassword({ email, password });
        error = res.error;
      }

      if (error) {
        if (/banned/i.test(error.message)) {
          setErrorMsg("Dein Konto ist noch nicht freigegeben oder gesperrt. Bitte melde dich beim Administrator.");
        } else if (error.message === "Invalid login credentials") {
          setErrorMsg("Ungültige E-Mail-Adresse oder falsches Passwort.");
        } else {
          setErrorMsg(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Harte Navigation statt router.push: garantiert, dass der Server das
      // frische Auth-Cookie sieht und direkt das Ziel rendert (kein Bounce/Race).
      // Ziel: ?next=… (nur interne Pfade), sonst /.
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(loginRedirectTarget(next));
      return;
    } catch {
      setErrorMsg("Ein unerwarteter Fehler ist aufgetreten.");
      setIsSubmitting(false);
    }
  };

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
            style={{
              fontSize: 28,
              fontWeight: 300,
              marginTop: 6,
              letterSpacing: "-0.015em",
            }}
          >
            Anmelden
          </h1>
        </div>

        {errorMsg && (
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
            ❌ {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {mode === "name" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="grb-eyebrow">Name</span>
              <select
                required
                className="grb-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="" disabled>
                  Name auswählen …
                </option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="grb-eyebrow">E-Mail-Adresse</span>
              <input
                type="email"
                required
                className="grb-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@grabner-design.com"
              />
            </label>
          )}

          <label
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span className="grb-eyebrow">Passwort</span>
            <input
              type="password"
              required
              className="grb-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="grb-btn grb-btn-primary"
            style={{ marginTop: 8 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Wird angemeldet..." : "Anmelden"}
          </button>
        </form>

        {choices.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "name" ? "email" : "name");
              setErrorMsg("");
            }}
            style={{
              background: "none",
              border: 0,
              cursor: "pointer",
              textAlign: "center",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--fg-muted)",
              marginTop: -12,
            }}
          >
            {mode === "name" ? "Stattdessen mit E-Mail anmelden" : "Stattdessen Namen auswählen"}
          </button>
        )}

        <a
          href="/registrieren"
          style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--fg)",
          }}
        >
          Neu hier? Jetzt registrieren
        </a>

        <a
          href="/passwort-vergessen"
          style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--fg-muted)",
          }}
        >
          Passwort vergessen?
        </a>
      </div>
    </div>
  );
}
