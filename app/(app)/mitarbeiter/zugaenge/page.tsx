import Link from "next/link";
import { getEmployees } from "@/lib/data/employees";
import { hasAdminRights } from "@/lib/auth/app-role";
import { APPS, resolveAppAccess } from "@/lib/apps";
import "./zugaenge.css";
import { ZugaengeMatrix, type MatrixRow } from "./ZugaengeMatrix";

export const dynamic = "force-dynamic";

/** Zugänge-Matrix: Zeilen = aktive Mitarbeiter, Spalten = Apps. Zugriff regelt das Layout /mitarbeiter. */
export default async function ZugaengePage() {
  const employees = await getEmployees();

  const rows: MatrixRow[] = employees
    .filter((e) => e.id && e.is_active !== false)
    .map((e) => {
      const isAdmin = hasAdminRights(e.app_role ?? "mitarbeiter");
      return {
        id: e.id!,
        name: e.name,
        initials: e.initials ?? e.kuerzel,
        isAdmin,
        apps: resolveAppAccess(e.app_access, isAdmin),
      };
    });

  return (
    <div style={{ padding: "40px 32px 80px", maxWidth: 1320, margin: "0 auto", width: "100%" }}>
      <Link
        href="/mitarbeiter"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          color: "var(--fg-muted)",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        ← Mitarbeiter
      </Link>
      <div style={{ margin: "14px 0 28px", paddingBottom: 18, borderBottom: "1px solid var(--fg)" }}>
        <span className="grb-eyebrow">Verwaltung</span>
        <h1 className="grb-h-h1" style={{ marginTop: 6, fontSize: 40, letterSpacing: "-0.02em" }}>
          Zugänge
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--fg-muted)", marginTop: 6 }}>
          Wer darf welche App nutzen? Jeder Klick wird sofort gespeichert. Deaktivierte
          Mitarbeiter sind ausgeblendet.
        </p>
      </div>
      <ZugaengeMatrix
        apps={APPS.map((a) => ({ key: a.key, title: a.title, live: a.live }))}
        initialRows={rows}
      />
    </div>
  );
}
