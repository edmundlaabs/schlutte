"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";

/**
 * Passwort-Recovery (Selbstservice): schickt einen Link an die E-Mail-Adresse.
 * Der Link führt auf /passwort-neu; das dort gesetzte Passwort gilt für die
 * Schlutte und alle freigeschalteten Apps mit eigenem Konto (Gerda).
 */
export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/passwort-neu`,
      });
      if (error && error.status === 429) {
        setErrorMsg("Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen.");
      } else if (error) {
        setErrorMsg(`Die E-Mail konnte nicht versendet werden: ${error.message}`);
      } else {
        setSent(true);
      }
    } catch {
      setErrorMsg("Ein unerwarteter Fehler ist aufgetreten.");
    }
    setIsSubmitting(false);
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
            style={{ fontSize: 28, fontWeight: 300, marginTop: 6, letterSpacing: "-0.015em" }}
          >
            Passwort vergessen
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
            {errorMsg}
          </div>
        )}

        {sent ? (
          <p
            role="status"
            style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--fg)", lineHeight: 1.5 }}
          >
            Falls zu <strong>{email.trim()}</strong> ein Zugang existiert, ist eine E-Mail mit einem
            Link zum Zurücksetzen unterwegs. Das neue Passwort gilt für die Schlutte und alle für
            dich freigeschalteten Apps.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            <button type="submit" className="grb-btn grb-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Wird gesendet …" : "Link zum Zurücksetzen senden"}
            </button>
          </form>
        )}

        <a
          href="/login"
          style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-muted)" }}
        >
          ← Zurück zur Anmeldung
        </a>
      </div>
    </div>
  );
}
