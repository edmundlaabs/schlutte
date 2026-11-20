import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/auth/app-access";
import { getVorlagen } from "@/lib/data/abnahme";
import { VorlagenEditor } from "@/components/abnahme/VorlagenEditor";
import type { Vorlage } from "@/lib/abnahme/types";

export const metadata = { title: "Vorlagen" };

export default async function VorlagenPage() {
  const ctx = await requireAppAccess("abnahme");
  if (!ctx.isFinance) redirect("/abnahme");
  let vorlagen: Vorlage[] = [];
  let fehler = "";
  try {
    vorlagen = await getVorlagen();
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Vorlagen nicht verfügbar.";
  }
  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme</span>
        <h1 className="aus-h1">Prüfpunkt-Vorlagen</h1>
        <p className="aus-lede">
          Je Möbeltyp eine Liste von Prüfpunkten. Beim Import wird anhand des Titels (Schrank, Regal, Garderobe, Handlauf)
          eine Vorlage vorgeschlagen und kann geändert werden. Position ohne Vorlage: nur als Ganzes abnehmen.
        </p>
      </header>
      {fehler && <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehler}</p></div></div>}
      <VorlagenEditor vorlagen={vorlagen} />
    </>
  );
}
