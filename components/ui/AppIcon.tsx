import type { AppIconName } from "@/lib/apps";

type Name = AppIconName | "arrow";

/** Linien-Icons der Apps (Startseite, App-Wechsler). */
export function AppIcon({
  name,
  size = 28,
  stroke = 1.4,
}: {
  name: Name;
  size?: number;
  stroke?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "workshop": return <svg {...p}><path d="m3 7 9 5 9-5"/><path d="M21 7v10l-9 5-9-5V7l9-5 9 5z"/><path d="M12 12v10"/></svg>;
    case "staff":    return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>;
    case "order":    return <svg {...p}><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8 11h8M8 15h6"/></svg>;
    case "vacation": return <svg {...p}><circle cx="12" cy="9" r="3.5"/><path d="M12 2v1.5M12 14.5V16M19 9h-1.5M6.5 9H5M16.95 4.05l-1.06 1.06M8.11 12.89l-1.06 1.06M16.95 13.95l-1.06-1.06M8.11 5.11 7.05 4.05M3 21h18"/></svg>;
    case "inventory": return <svg {...p}><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35a2 2 0 0 1 1.26-1.86l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12"/><rect x="6" y="10" width="12" height="12"/></svg>;
    case "report":   return <svg {...p}><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/></svg>;
    case "receipt":  return <svg {...p}><path d="M5 3h14v18l-2.33-1.5-2.34 1.5-2.33-1.5-2.33 1.5-2.34-1.5L5 21z"/><path d="M9 7.5h6M9 11h6M9 14.5h3.5"/></svg>;
    case "arrow":    return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "cad":      return <svg {...p}><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>;
    case "project":  return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11"/></svg>;
    default: return null;
  }
}
