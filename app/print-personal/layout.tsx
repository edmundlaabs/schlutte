import type { ReactNode } from "react";
import "@/styles/print.css";
import { requireAppAccess } from "@/lib/auth/app-access";

export const dynamic = "force-dynamic";

/** Druckseiten der App „Druckvorlagen Büro/Personal“ — wie app/print, aber mit Zugriff „personal“. */
export default async function PrintPersonalLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("personal");
  // Force light color scheme for prints — no dark theme on paper.
  return <div className="print-root" data-theme="light">{children}</div>;
}
