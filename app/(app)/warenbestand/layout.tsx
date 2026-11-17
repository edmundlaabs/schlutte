import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";

/** Zugriff nur mit Freischaltung für die App „Warenbestand“ (Admin → Zugänge). */
export default async function WarenbestandLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("warenbestand");
  return <>{children}</>;
}
