"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Employee } from "@/lib/types";
import { APP_ROLES, roleLabel } from "@/lib/auth/app-role";
import { ALL_APP_KEYS, APPS } from "@/lib/apps";
import { createEmployeeAction, updateEmployeeAction } from "./actions";

type State = { error?: string } | null;

export function EmployeeForm({
  employee,
}: {
  employee?: Employee;
}) {
  const isEditing = !!employee?.id;
  // Bearbeiten: vergebene Apps (Spalte fehlt noch → alle). Neu: keine Vorauswahl.
  const grantedApps = isEditing ? employee?.app_access ?? ALL_APP_KEYS : [];

  // Bind the id for update action
  const boundAction = isEditing
    ? updateEmployeeAction.bind(null, employee!.id!)
    : createEmployeeAction;

  const [state, action, isPending] = useActionState<State, FormData>(
    boundAction,
    null
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {state?.error && (
        <div
          style={{
            background: "var(--bg-alt)",
            border: "1px solid var(--border-strong)",
            padding: "12px 16px",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--fg)",
          }}
        >
          ⚠ {state.error}
        </div>
      )}

      {/* Kürzel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="emp-initials"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)" }}
        >
          Kürzel *
        </label>
        <input
          id="emp-initials"
          name="initials"
          type="text"
          required
          maxLength={3}
          defaultValue={employee?.initials ?? ""}
          placeholder="z.B. EDL"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            padding: "10px 14px",
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--fg)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            width: 120,
          }}
        />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>
          1–3 Buchstaben, wird automatisch großgeschrieben, muss eindeutig sein.
        </span>
      </div>

      {/* Name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="emp-name"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)" }}
        >
          Name *
        </label>
        <input
          id="emp-name"
          name="name"
          type="text"
          required
          defaultValue={employee?.name ?? ""}
          placeholder="Vollständiger Name"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            padding: "10px 14px",
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--fg)",
            maxWidth: 400,
          }}
        />
      </div>

      {/* E-Mail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="emp-email"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)" }}
        >
          E-Mail (optional)
        </label>
        <input
          id="emp-email"
          name="email"
          type="email"
          defaultValue={employee?.email ?? ""}
          placeholder="max@grabner-design.at"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            padding: "10px 14px",
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--fg)",
            maxWidth: 400,
          }}
        />
      </div>

      {/* Passwort (nur beim Anlegen — optional, erzeugt den Login) */}
      {!isEditing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="emp-password"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)" }}
          >
            Passwort (optional)
          </label>
          <input
            id="emp-password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Mind. 8 Zeichen — leer = kein Login"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              padding: "10px 14px",
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--fg)",
              maxWidth: 400,
            }}
          />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>
            Wird ein Passwort gesetzt, wird zusammen mit der E-Mail direkt ein Login angelegt.
            Ohne Passwort entsteht nur ein Datensatz (Login später über „Bearbeiten“).
          </span>
        </div>
      )}

      {/* Rolle */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="emp-role"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)" }}
        >
          Rolle
        </label>
        <select
          id="emp-role"
          name="role"
          defaultValue={employee?.app_role ?? (employee?.is_admin ? "admin" : "mitarbeiter")}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            padding: "10px 14px",
            border: "1px solid var(--border-strong)",
            borderRadius: 0,
            background: "var(--bg)",
            color: "var(--fg)",
            maxWidth: 400,
          }}
        >
          {APP_ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>
          Admin: Mitarbeiterverwaltung und alle Admin-Funktionen. CEO und Admin: zusätzlich
          Kreditkarten-Abgleich und Einstellungen unter „Auslagen &amp; Belege“.
        </span>
      </div>

      {/* App-Berechtigungen */}
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <legend
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-muted)", padding: 0, marginBottom: 10 }}
        >
          App-Berechtigungen
        </legend>
        <input type="hidden" name="apps_present" value="1" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px 24px", maxWidth: 640 }}>
          {APPS.map((app) => (
            <label
              key={app.key}
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14 }}
            >
              <input
                type="checkbox"
                name="apps"
                value={app.key}
                defaultChecked={grantedApps.includes(app.key)}
              />
              <span>
                {app.title}
                {!app.live && <span style={{ color: "var(--fg-subtle)" }}> (folgt)</span>}
              </span>
            </label>
          ))}
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)", maxWidth: 640 }}>
          Legt fest, welche Apps der Mitarbeiter im Intranet sieht und öffnen darf. CEO und Admin
          haben immer Zugriff auf alle Apps. Gerda prüft die Freischaltung direkt in der Datenbank.
          * Externe App ohne Anbindung — hier wird nur die Kachel ausgeblendet.
        </span>
      </fieldset>

      {/* Aktiv */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14 }}>
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={employee?.is_active !== false}
          />
          Aktiv
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          type="submit"
          className="grb-btn grb-btn-primary"
          disabled={isPending}
        >
          <Icon name="check" size={14} />
          {isPending
            ? "Wird gespeichert …"
            : isEditing
            ? "Änderungen speichern"
            : "Mitarbeiter anlegen"}
        </button>
        <Link href="/mitarbeiter" className="grb-btn grb-btn-ghost">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
