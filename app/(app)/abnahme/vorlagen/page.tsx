import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/auth/app-access";
import { getProtokollVorlagen, getVorlagen } from "@/lib/data/abnahme";
import { VorlagenEditor } from "@/components/abnahme/VorlagenEditor";
import { ProtokollVorlagenEditor } from "@/components/abnahme/ProtokollVorlagenEditor";
import type { ProtokollVorlage, Vorlage } from "@/lib/abnahme/types";

export const metadata = { title: "Vorlagen" };

export default async function VorlagenPage({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  const ctx = await requireAppAccess("abnahme");
  if (!ctx.isFinance) redirect("/abnahme");
  const { bereich } = await searchParams;
  const protokoll = bereich === "protokoll";

  let vorlagen: Vorlage[] = [];
  let protokollVorlagen: ProtokollVorlage[] = [];
  let fehler = "";
  try {
    vorlagen = await getVorlagen();
    if (protokoll) protokollVorlagen = await getProtokollVorlagen();
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Vorlagen nicht verfügbar.";
    if (protokoll) fehler += " Wurde die Migration 20261125_abnahme_manuell.sql ausgeführt?";
  }
  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme</span>
        <h1 className="aus-h1">Vorlagen</h1>
        <p className="aus-lede">
          {protokoll
            ? "Komplette Sets aus Räumen, Positionen und Prüfpunkten. Im manuellen Editor lassen sie sich mit „Aus Vorlage einfügen“ übernehmen und danach frei ändern."
            : "Je Möbeltyp eine Liste von Prüfpunkten. Beim Import wird anhand des Titels (Schrank, Regal, Garderobe, Handlauf) eine Vorlage vorgeschlagen und kann geändert werden. Position ohne Vorlage: nur als Ganzes abnehmen."}
        </p>
      </header>
      <nav className="abn-tabs" aria-label="Vorlagenbereich">
        <Link href="/abnahme/vorlagen" className={protokoll ? "abn-tab" : "abn-tab is-on"} aria-current={protokoll ? undefined : "page"}>Möbeltyp-Vorlagen</Link>
        <Link href="/abnahme/vorlagen?bereich=protokoll" className={protokoll ? "abn-tab is-on" : "abn-tab"} aria-current={protokoll ? "page" : undefined}>Protokoll-Vorlagen</Link>
      </nav>
      {fehler && <div className="aus-note is-danger" role="alert"><div className="aus-note-body"><p>{fehler}</p></div></div>}
      {protokoll ? <ProtokollVorlagenEditor vorlagen={protokollVorlagen} moebeltypen={vorlagen} /> : <VorlagenEditor vorlagen={vorlagen} />}
    </>
  );
}
