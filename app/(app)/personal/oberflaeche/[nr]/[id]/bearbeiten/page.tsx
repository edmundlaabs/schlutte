import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommissionByNumber } from "@/lib/data/commissions";
import { getDocumentById } from "@/lib/data/documents";
import { getActiveEmployees, getCurrentEmployee } from "@/lib/data/employees";
import { OberflaecheForm } from "../../neu/OberflaecheForm";
import type { OberflaecheFormData } from "@/lib/types";

export default async function EditOberflaechePage({
  params,
}: {
  params: Promise<{ nr: string; id: string }>;
}) {
  const { nr, id } = await params;
  const [commission, document, employees, me] = await Promise.all([
    getCommissionByNumber(nr),
    getDocumentById(id),
    getActiveEmployees(),
    getCurrentEmployee(),
  ]);

  if (!commission || !document) notFound();
  if (document.document_type !== "oberflaeche") notFound();

  return (
    <div style={{ padding: "40px 56px 80px", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div>
        <Link
          href="/personal"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--fg-muted)", textTransform: "uppercase", textDecoration: "none" }}
        >
          ← Büro/Personal
        </Link>
        <span className="grb-eyebrow" style={{ display: "block", marginTop: 18 }}>
          Dokument bearbeiten
        </span>
        <h1 className="grb-h-h1" style={{ marginTop: 6 }}>
          Auftragsoberfläche bearbeiten
        </h1>
        <p className="gd-lede" style={{ marginTop: 10 }}>
          Kommission <strong>{commission.no}</strong> ({commission.client}).
        </p>
      </div>

      <OberflaecheForm
        commission={commission}
        documentId={document.id}
        initialData={document.form_data as unknown as OberflaecheFormData}
        employees={employees.map((e) => ({ initials: e.initials ?? e.kuerzel, name: e.name }))}
        currentInitials={me?.initials}
      />
    </div>
  );
}
