import Link from "next/link";
import { redirect } from "next/navigation";
import { appAccessOf } from "@/lib/auth/app-access";
import { getCurrentUserContext, roleLabel } from "@/lib/auth/roles";
import { APPS } from "@/lib/apps";

export const metadata = { title: "Mein Konto — Schlutte" };

export default async function KontoPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  const apps = appAccessOf(ctx);

  return (
    <div style={{ padding: "40px 24px 80px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--fg)", marginBottom: 32 }}>
        <span className="grb-eyebrow">Schlutte · Konto</span>
        <h1 className="grb-h-h1" style={{ marginTop: 6, fontSize: 36, letterSpacing: "-0.02em" }}>Mein Konto</h1>
      </div>
      <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 30%) 1fr", margin: 0 }}>
        {[
          ["Name", ctx.employee?.name ?? "—"],
          ["Kürzel", ctx.employee?.initials ?? "—"],
          ["E-Mail", ctx.email ?? "—"],
          ["Rolle", roleLabel(ctx.role)],
          ["Apps", APPS.filter((a) => apps.includes(a.key)).map((a) => a.title).join(", ") || "Keine freigeschaltet"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt className="grb-eyebrow" style={{ padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}>{label}</dt>
            <dd style={{ margin: 0, padding: "12px 0", borderBottom: "1px solid var(--hairline)", fontSize: 15 }}>{value}</dd>
          </div>
        ))}
      </dl>
      <p style={{ marginTop: 28 }}>
        <Link href="/passwort-neu" className="grb-btn-link">Passwort ändern</Link>
      </p>
    </div>
  );
}
