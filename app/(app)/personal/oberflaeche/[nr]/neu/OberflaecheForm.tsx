"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { OberflaecheLabel, LABEL_W_MM, LABEL_H_MM } from "@/components/print/OberflaecheLabel";
import type { Commission, OberflaecheFormData } from "@/lib/types";
import { saveOberflaecheAction } from "./actions";

type EmployeeOption = { initials: string; name: string };

const PREVIEW_SCALE = 0.62;
const MM_PX = 96 / 25.4;

const three = (a?: string[]) => [0, 1, 2].map((i) => a?.[i] ?? "");

export function OberflaecheForm({
  commission,
  documentId,
  initialData,
  employees,
  currentInitials,
}: {
  commission: Commission;
  documentId?: string;
  initialData?: OberflaecheFormData;
  employees: EmployeeOption[];
  currentInitials?: string;
}) {
  const router = useRouter();

  const [customer, setCustomer] = useState(initialData?.customer ?? commission.client ?? "");
  const [commissionNo, setCommissionNo] = useState(initialData?.commissionNo ?? commission.no);
  const [position, setPosition] = useState(initialData?.position ?? commission.project ?? "");
  const [woodType, setWoodType] = useState(initialData?.woodType ?? "");
  const [oiled, setOiled] = useState(initialData?.oiled ?? false);
  const [stained, setStained] = useState(initialData?.stained ?? false);
  const [lacquered, setLacquered] = useState(initialData?.lacquered ?? false);
  const [oilSteps, setOilSteps] = useState<string[]>(three(initialData?.oilSteps));
  const [stainSteps, setStainSteps] = useState<string[]>(three(initialData?.stainSteps));
  const [lacquerSteps, setLacquerSteps] = useState<string[]>(three(initialData?.lacquerSteps));
  const [preparation, setPreparation] = useState(initialData?.preparation ?? "");
  const [date, setDate] = useState(initialData?.date ?? "");
  const [countInput, setCountInput] = useState(String(initialData?.labelCount ?? 1));
  const [owner, setOwner] = useState(initialData?.employeeInitials || currentInitials || "");

  const [countError, setCountError] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const parsedCount = /^\d+$/.test(countInput.trim()) ? parseInt(countInput, 10) : NaN;
  const countValid = Number.isInteger(parsedCount) && parsedCount >= 1;

  const data: OberflaecheFormData = {
    customer,
    commissionNo,
    position,
    woodType,
    oiled,
    stained,
    lacquered,
    oilSteps,
    stainSteps,
    lacquerSteps,
    preparation,
    date: date || undefined,
    labelCount: countValid ? parsedCount : 1,
    employeeInitials: owner,
  };

  const setStep = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((prev) => prev.map((x, j) => (j === i ? v : x)));

  // Vorbereitung: max. 3 Zeilen.
  const changePreparation = (v: string) => setPreparation(v.split("\n").slice(0, 3).join("\n"));

  const preventEnterSubmit = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    if (!countValid) {
      setCountError("Anzahl Labels muss eine ganze Zahl von mindestens 1 sein.");
      hasError = true;
    } else setCountError("");
    if (owner.length > 3) {
      setOwnerError("Mitarbeiterkürzel darf maximal 3 Zeichen lang sein.");
      hasError = true;
    } else setOwnerError("");
    if (hasError) return;

    setIsSaving(true);
    setSaveError("");
    const result = await saveOberflaecheAction(commission.no, data, documentId);
    setIsSaving(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setIsSaved(true);
    router.push(`/print-personal/oberflaeche/document/${result.documentId}`);
    router.refresh();
  };

  const previewW = LABEL_W_MM * MM_PX * PREVIEW_SCALE;
  const previewH = LABEL_H_MM * MM_PX * PREVIEW_SCALE;
  const sheetCount = Math.ceil(data.labelCount / 2);

  return (
    <form
      onSubmit={handleSave}
      onKeyDown={preventEnterSubmit}
      style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <div style={{ flex: "1 1 460px", maxWidth: 560, minWidth: 0, display: "flex", flexDirection: "column", gap: 22 }}>
        {isSaved && (
          <div role="alert" style={alertStyle("var(--gd-success)")}>
            ✓ Auftragsoberfläche gespeichert! Weiterleitung...
          </div>
        )}
        {saveError && (
          <div role="alert" style={alertStyle("var(--gd-danger)")}>
            ❌ {saveError}
          </div>
        )}

        <Field label="Kunde" hint="Aus der Kommission vorbelegt, überschreibbar.">
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} className="grb-input" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Kommission">
            <input value={commissionNo} onChange={(e) => setCommissionNo(e.target.value)} className="grb-input" />
          </Field>
          <Field label="Position">
            <input value={position} onChange={(e) => setPosition(e.target.value)} className="grb-input" />
          </Field>
        </div>

        <Field label="Holzart" hint="Freitext, z. B. Eiche geräuchert.">
          <input value={woodType} onChange={(e) => setWoodType(e.target.value)} className="grb-input" />
        </Field>

        <Group title="Geölt" checked={oiled} onChecked={setOiled} labels={["1. Ölung", "2. Ölung", "3. Ölung"]} values={oilSteps} onChange={(i, v) => setStep(setOilSteps, i, v)} />
        <Group title="Gebeizt" checked={stained} onChecked={setStained} labels={["Farbton 1", "Farbton 2", "Farbton 3"]} values={stainSteps} onChange={(i, v) => setStep(setStainSteps, i, v)} />
        <Group title="Lackiert" checked={lacquered} onChecked={setLacquered} labels={["1. Lackschicht", "2. Lackschicht", "3. Lackschicht"]} values={lacquerSteps} onChange={(i, v) => setStep(setLacquerSteps, i, v)} />

        <Field label="Vorbereitung" hint="Maximal 3 Zeilen, eine Angabe pro Zeile.">
          <textarea
            value={preparation}
            onChange={(e) => changePreparation(e.target.value)}
            rows={3}
            className="grb-input"
            style={{ resize: "none", fontFamily: "var(--font-sans)" }}
          />
        </Field>

        <Field label="Datum (optional)" hint="Leer lassen, wenn handschriftlich eingetragen wird.">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="grb-input" style={{ maxWidth: 220 }} />
        </Field>

        <Field
          label="Anzahl Labels"
          hint={countValid ? `${sheetCount} Blatt A4 quer, je 2 Labels nebeneinander${data.labelCount % 2 ? " (letztes Blatt nur links)" : ""}.` : "Pflichtfeld. Ganze Zahl, mindestens 1."}
          error={countError}
        >
          <input
            type="number"
            min={1}
            step={1}
            required
            inputMode="numeric"
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            className="grb-input"
            style={{ maxWidth: 220 }}
          />
        </Field>

        <Field label="Mitarbeiter" hint="Aus der Mitarbeiterverwaltung." error={ownerError}>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="grb-input" style={{ maxWidth: 320 }} required>
            <option value="">— wählen —</option>
            {employees.map((e) => (
              <option key={e.initials} value={e.initials}>
                {e.name} ({e.initials})
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <button type="submit" className="grb-btn grb-btn-primary" disabled={isSaving || isSaved}>
            <Icon name="print" size={14} />
            {isSaved ? "Weiterleitung..." : isSaving ? "Wird gespeichert..." : "Speichern & drucken"}
          </button>
          <Link href="/personal/oberflaeche" className="grb-btn grb-btn-quiet">
            Abbrechen
          </Link>
        </div>
      </div>

      {/* Live-Vorschau: dieselbe Label-Komponente wie im Druck, nur per CSS verkleinert. */}
      <aside style={{ flex: "0 0 auto", position: "sticky", top: 24 }}>
        <span className="grb-eyebrow" style={{ display: "block", marginBottom: 8 }}>
          Vorschau · A5 hochkant
        </span>
        <div style={{ width: previewW, height: previewH, border: "1px solid var(--border-strong)", background: "#fff", overflow: "hidden" }}>
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left", width: `${LABEL_W_MM}mm`, height: `${LABEL_H_MM}mm` }}>
            <OberflaecheLabel data={data} />
          </div>
        </div>
      </aside>
    </form>
  );
}

function alertStyle(color: string): React.CSSProperties {
  return {
    border: `1px solid ${color}`,
    color,
    background: "var(--bg-alt)",
    padding: "12px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
  };
}

function Group({
  title,
  checked,
  onChecked,
  labels,
  values,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
  labels: string[];
  values: string[];
  onChange: (i: number, v: string) => void;
}) {
  return (
    <fieldset style={{ border: "1px solid var(--border)", padding: "14px 16px", margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChecked(e.target.checked)} />
        <span className="grb-eyebrow">{title}</span>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {labels.map((l, i) => (
          <Field key={l} label={l}>
            <input value={values[i]} onChange={(e) => onChange(i, e.target.value)} className="grb-input" />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <span className="grb-eyebrow">{label}</span>
      {children}
      {hint && !error && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--gd-danger)" }}>{error}</span>
      )}
    </label>
  );
}
