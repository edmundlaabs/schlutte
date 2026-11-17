import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";

/** Zugriff nur mit Freischaltung für die App „PandaCAD“ (Mitarbeiter → Zugänge). */
export default async function PandaCadLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("pandacad");
  return <>{children}</>;
}
