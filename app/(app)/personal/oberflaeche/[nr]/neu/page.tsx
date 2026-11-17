import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommissionByNumber } from "@/lib/data/commissions";
import { getActiveEmployees, getCurrentEmployee } from "@/lib/data/employees";
import { OberflaecheForm } from "./OberflaecheForm";

export default async function NewOberflaechePage({
  params,
}: {
  params: Promise<{ nr: string }>;
}) {
  const { nr } = await params;
  const [commission, employees, me] = await Promise.all([
    getCommissionByNumber(nr),
    getActiveEmployees(),
    getCurrentEmployee(),
  ]);
  if (!commission) notFound();

  return (
    <div style={{ padding: "40px 56px 80px", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div>
        <Link
          href="/personal/oberflaeche"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--fg-muted)", textTransform: "uppercase", textDecoration: "none" }}
        >
          ← Kommission wählen
        </Link>
        <span className="grb-eyebrow" style={{ display: "block", marginTop: 18 }}>
          Auftragsoberfläche (Muster)
        </span>
        <h1 className="grb-h-h1" style={{ marginTop: 6 }}>
          Auftragsoberfläche erstellen
        </h1>
        <p className="gd-lede" style={{ marginTop: 10 }}>
          Neues Oberflächen-Muster für die Kommission <strong>{commission.no}</strong>.
        </p>
      </div>

      <OberflaecheForm
        commission={commission}
        employees={employees.map((e) => ({ initials: e.initials ?? e.kuerzel, name: e.name }))}
        currentInitials={me?.initials}
      />
    </div>
  );
}
