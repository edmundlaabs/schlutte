import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const TEMPLATES = [
  {
    id: "oberflaeche",
    name: "Auftragsoberfläche (Muster)",
    hint: "Geölt · Gebeizt · Lackiert. A5-Label, zwei pro A4-Blatt (quer).",
    href: "/personal/oberflaeche",
  },
];

export default function PersonalHomePage() {
  return (
    <div
      style={{
        padding: "40px 56px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Startseite
        </Link>
        <span className="grb-eyebrow" style={{ display: "block", marginTop: 18 }}>
          Büro · Personal
        </span>
        <h1 className="grb-h-h1" style={{ marginTop: 6 }}>
          Druckvorlagen Büro/Personal
        </h1>
        <p className="gd-lede" style={{ marginTop: 10 }}>
          Vorlagen für Büro und Verwaltung. Weitere Vorlagen folgen.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {TEMPLATES.map((t, i) => (
          <Link
            key={t.id}
            href={t.href}
            className="grb-card-hover"
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: 32,
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              position: "relative",
              minHeight: 240,
            }}
          >
            <span style={{ position: "absolute", top: 16, right: 16, color: "var(--fg-subtle)" }}>
              <Icon name="doc-stripe" size={24} stroke={1.25} />
            </span>
            <span className="grb-eyebrow" style={{ color: "var(--accent)" }}>
              {String(i + 1).padStart(2, "0")} / Muster
            </span>
            <h2 className="grb-h-h2" style={{ fontSize: 28, margin: "12px 0 6px" }}>
              {t.name}
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.5, margin: 0 }}>
              {t.hint}
            </p>
            <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg)" }}>
              Erstellen <Icon name="arrow" size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
