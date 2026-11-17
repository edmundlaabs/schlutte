import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/roles";
import { hasAdminRights } from "@/lib/auth/app-role";
import { Downloads, type DownloadItem } from "./Downloads";
import { Steps, type Step } from "./Steps";

export const dynamic = "force-dynamic";

const STEPS: Step[] = [
  {
    title: "Voraussetzungen",
    body: [
      "Windows-PC im Büro.",
      "Netzlaufwerk R: ist verbunden (im Explorer unter „Dieser PC“ sichtbar).",
      "Administratorrechte zum Installieren.",
    ],
  },
  {
    title: "Installation",
    body: [
      "Installer vom Netzlaufwerk starten (Rechtsklick → Als Administrator ausführen). Die Datei hat 912 MB und gibt es bewusst nicht als Browser-Download.",
    ],
    path: "R:\\Palette CAD\\Installationsdateien\\PaletteShowroomSetupDEU.exe",
  },
  {
    title: "Update",
    body: [
      "Update vom Netzlaufwerk starten (672 MB, ebenfalls kein Browser-Download).",
      "Hinweise zum Updatemanager: PDF „Updatemanageranleitung“ im Downloads-Bereich unten.",
    ],
    path: "R:\\Palette CAD\\Installationsdateien\\paletteCAD1010UpdateDEU64.exe",
  },
  {
    title: "Lizenz und Login",
    body: ["Keine Zugangsdaten auf dieser Seite."],
    placeholder: "Wird von Noah ergänzt.",
  },
  {
    title: "Pfade einrichten",
    body: [
      "Die Datei „Pfade für PaletteCAD.pcadconfig“ (Downloads unten) herunterladen und in Palette CAD importieren. Sie setzt alle Datenpfade auf R:\\Palette CAD\\Dat\\… (Bom, Styles, Frames usw.).",
    ],
    placeholder: "Import-Schritte in Palette CAD: von Noah zu bestätigen.",
  },
  {
    title: "Grabner-Design-Standards (Materialien/Objekte)",
    body: [],
    placeholder: "Ablage auf R: und Einrichtung: von Noah zu bestätigen.",
  },
  {
    title: "Test",
    body: ["Ein Testprojekt öffnen und prüfen, dass die Bibliothek „GD Korpus“ sichtbar ist."],
  },
];

export default async function PandaCadPage() {
  const ctx = await getCurrentUserContext();
  const isAdmin = !!ctx && hasAdminRights(ctx.role);

  const supabase = await createClient();
  const { data } = await supabase
    .from("pandacad_downloads")
    .select("id, titel, beschreibung")
    .order("reihenfolge", { ascending: true })
    .order("titel", { ascending: true });
  const downloads: DownloadItem[] = data ?? [];

  return (
    <div style={{ padding: "40px 56px 80px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <Link
        href="/"
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--fg-muted)", textTransform: "uppercase", textDecoration: "none" }}
      >
        ← Intranet
      </Link>
      <div style={{ margin: "14px 0 28px", paddingBottom: 18, borderBottom: "1px solid var(--fg)" }}>
        <span className="grb-eyebrow">PandaCAD</span>
        <h1 className="grb-h-h1" style={{ marginTop: 6, fontSize: 40, letterSpacing: "-0.02em" }}>
          Palette CAD einrichten
        </h1>
        <p style={{ fontSize: 14, color: "var(--fg-muted)", marginTop: 6 }}>
          Installation auf Windows-PCs im Büro (Palette CAD mit Holztechnik/PaletteCAM, Version 10.52).
        </p>
      </div>

      {isAdmin && (
        <p style={{ border: "1px solid var(--accent)", padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
          <strong>Nur für Admin sichtbar:</strong> Die Datei „Pfade für PaletteCAD.pcadconfig“ nennt Version
          10.18.051, im Einsatz ist 10.52. Bitte prüfen, ob die Datei noch aktuell ist.
        </p>
      )}

      <Steps steps={STEPS} />

      <h2 style={{ fontSize: 22, fontWeight: 500, margin: "40px 0 8px" }}>Downloads</h2>
      <Downloads items={downloads} />
    </div>
  );
}
