import type { ReactNode } from "react";
import "@/styles/print.css";
import { requireAppAccess } from "@/lib/auth/app-access";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("werkstatt");
  // Force light color scheme for prints — no dark theme on paper.
  return <div className="print-root" data-theme="light">{children}</div>;
}
