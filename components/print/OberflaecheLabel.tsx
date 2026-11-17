import type { CSSProperties } from "react";
import { FitText } from "@/components/print/FitText";
import { formatDate } from "@/lib/utils";
import type { OberflaecheFormData } from "@/lib/types";

// Druck: nur 100 % Schwarz (wie PaletteSheet), Hairlines 1 px, scharfe Ecken.
const INK = "#000";
const HAIRLINE = "1px solid #000";

/** Exaktes A5 hochkant. */
export const LABEL_W_MM = 148;
export const LABEL_H_MM = 210;

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: INK,
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const valueStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  color: INK,
  lineHeight: 1.25,
};

function Checkbox({ checked, size = 13 }: { checked?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        border: "1.25px solid #000",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && (
        <svg viewBox="0 0 12 12" width={size - 3} height={size - 3}>
          <path d="M2 6.5 L5 9.5 L10.5 2.5" fill="none" stroke="#000" strokeWidth="1.6" />
        </svg>
      )}
    </span>
  );
}

/** Beschriftung + Wert (FitText) auf einer Linie. */
function Field({ label, value, size = 13 }: { label: string; value: string; size?: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...eyebrow, marginBottom: 2 }}>{label}</div>
      <div style={{ borderBottom: HAIRLINE, height: size * 1.5, display: "flex", alignItems: "flex-end", minWidth: 0 }}>
        <div style={{ width: "100%", minWidth: 0 }}>
          <FitText text={value} maxFontSize={size} style={valueStyle} />
        </div>
      </div>
    </div>
  );
}

/** Zeile mit kleiner Beschriftung links und Linie rechts (Freitext). */
function StepLine({ label, value }: { label?: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 34, borderBottom: HAIRLINE, minWidth: 0 }}>
      {label && (
        <span style={{ ...eyebrow, fontSize: 7, letterSpacing: "0.12em", flexShrink: 0, paddingBottom: 2 }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <FitText text={value} maxFontSize={11} style={valueStyle} />
      </div>
    </div>
  );
}

function Column({
  title,
  checked,
  labels,
  values,
}: {
  title: string;
  checked: boolean;
  labels: string[];
  values: string[];
}) {
  return (
    <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 4, borderBottom: "1.5px solid #000" }}>
        <Checkbox checked={checked} />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 15, color: INK, letterSpacing: "-0.01em" }}>
          {title}
        </span>
      </div>
      {labels.map((l, i) => (
        <div key={l} style={{ minWidth: 0 }}>
          <div style={{ ...eyebrow, fontSize: 7, letterSpacing: "0.12em", marginTop: 6 }}>{l}</div>
          <div style={{ borderBottom: HAIRLINE, height: 32, display: "flex", alignItems: "flex-end", minWidth: 0 }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <FitText text={values[i] ?? ""} maxFontSize={11} style={valueStyle} />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Auftragsoberfläche (Muster) — ein Label, exakt A5 hochkant (148 × 210 mm).
 * Alle Maße fix, nichts läuft aus dem Rahmen (overflow: hidden, FitText).
 */
export function OberflaecheLabel({ data }: { data: OberflaecheFormData }) {
  const prep = (data.preparation || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const prepLines = [0, 1, 2].map((i) => prep[i] ?? "");

  return (
    <div
      className="oberflaeche-label"
      style={{
        width: `${LABEL_W_MM}mm`,
        height: `${LABEL_H_MM}mm`,
        boxSizing: "border-box",
        padding: "10mm 11mm",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        color: INK,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Kopf */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: 8,
          borderBottom: HAIRLINE,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/grabner-logo.svg" alt="Grabner" style={{ height: 26, width: "auto", display: "block" }} />
        <div style={{ textAlign: "right", fontFamily: "var(--font-sans)", fontSize: 8, lineHeight: 1.45, color: INK }}>
          <div style={{ fontWeight: 600 }}>Grabner Design GmbH</div>
          <div>Tüchlinger Weg 1, 79400 Kandern</div>
          <div>info@grabner.design</div>
        </div>
      </header>

      {/* Titel */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 300,
          fontSize: 30,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          margin: "9mm 0 7mm",
          color: INK,
        }}
      >
        Auftragsoberfläche
      </h2>

      {/* Zeile 1: Kunde | Kommission | Position */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 10 }}>
        <Field label="Kunde" value={data.customer} />
        <Field label="Kommission" value={data.commissionNo} />
        <Field label="Position" value={data.position} />
      </div>

      {/* Holzart */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 3 }}>
          <Checkbox checked={!!data.woodType.trim()} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 400, color: INK }}>Holzart</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, borderBottom: HAIRLINE, height: 24, display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%" }}>
            <FitText text={data.woodType} maxFontSize={13} style={valueStyle} />
          </div>
        </div>
      </div>

      {/* Drei Spalten */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: "7mm" }}>
        <Column title="Geölt" checked={data.oiled} labels={["1. Ölung", "2. Ölung", "3. Ölung"]} values={data.oilSteps} />
        <Column title="Gebeizt" checked={data.stained} labels={["Farbton 1", "Farbton 2", "Farbton 3"]} values={data.stainSteps} />
        <Column
          title="Lackiert"
          checked={data.lacquered}
          labels={["1. Lackschicht", "2. Lackschicht", "3. Lackschicht"]}
          values={data.lacquerSteps}
        />
      </div>

      {/* Vorbereitung */}
      <section style={{ marginTop: "7mm", minHeight: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 400, paddingBottom: 2 }}>Vorbereitung</div>
        {prepLines.map((l, i) => (
          <StepLine key={i} value={l} />
        ))}
      </section>

      {/* Fuß: bleibt leer, handschriftlich */}
      <footer style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 14 }}>
        <div>
          <div style={{ borderBottom: HAIRLINE, height: 22, display: "flex", alignItems: "flex-end" }}>
            {data.date ? (
              <span style={{ ...valueStyle, fontSize: 11 }}>{formatDate(data.date)}</span>
            ) : null}
          </div>
          <div style={{ ...eyebrow, marginTop: 3 }}>Datum</div>
        </div>
        <div>
          <div style={{ borderBottom: HAIRLINE, height: 22 }} />
          <div style={{ ...eyebrow, marginTop: 3 }}>Unterschrift Kunde</div>
        </div>
      </footer>
    </div>
  );
}
