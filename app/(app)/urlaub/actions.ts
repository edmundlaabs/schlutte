"use server";

import { revalidatePath } from "next/cache";
import { requireUrlaub, requireUrlaubAdmin } from "@/lib/urlaub/auth";
import { fehlerText, UrlaubError } from "@/lib/urlaub/fehler";
import { notify } from "@/lib/urlaub/notify";
import { istISO } from "@/lib/urlaub/datum";
import { uebertragVorschlag } from "@/lib/urlaub/konto";
import {
  getAntrag,
  legeAntragAn,
  legeBetriebsferienAn,
  legePaarAn,
  legeSperreAn,
  listAntraege,
  listArbeitsmuster,
  listBetriebsferien,
  listKontingente,
  loescheBetriebsferien,
  loescheMuster,
  loeschePaar,
  loescheSperre,
  setzeStatus,
  speichereKontingent,
  speichereMuster,
} from "@/lib/data/urlaub";
import type { Antragsart } from "@/lib/urlaub/types";

export type UrlaubResult = { ok: boolean; message?: string; error?: string };

function neuLaden() {
  revalidatePath("/urlaub", "layout");
  revalidatePath("/");
}

async function run(fn: () => Promise<string | void>): Promise<UrlaubResult> {
  try {
    const message = await fn();
    neuLaden();
    return { ok: true, message: message || undefined };
  } catch (e) {
    if (!(e instanceof UrlaubError)) console.error("Urlaub:", e);
    return { ok: false, error: fehlerText(e) };
  }
}

function str(f: FormData, key: string): string {
  const v = f.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function zahl(f: FormData, key: string, standard = 0): number {
  const raw = str(f, key).replace(",", ".");
  if (raw === "") return standard;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new UrlaubError("Bitte eine gültige Zahl eingeben.");
  return n;
}
function datum(f: FormData, key: string, label: string): string {
  const v = str(f, key);
  if (!istISO(v)) throw new UrlaubError(`Bitte ${label} angeben.`);
  return v;
}

// ─── Mitarbeiter ─────────────────────────────────────────────────────────────

export async function antragStellenAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    const k = await requireUrlaub();
    const antrag = await legeAntragAn(k.employeeId, {
      art: str(formData, "art") as Antragsart,
      von: str(formData, "von"),
      bis: str(formData, "bis") || str(formData, "von"),
      halbtagStart: formData.get("halbtag_start") === "on",
      halbtagEnde: formData.get("halbtag_ende") === "on",
      kommentar: str(formData, "kommentar"),
    });
    await notify("beantragt", antrag);
    return "Antrag gestellt.";
  });
}

export async function zurueckziehenAction(id: string): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaub();
    const a = await setzeStatus(id, "beantragt", "zurueckgezogen");
    await notify("zurueckgezogen", a);
    return "Antrag zurückgezogen.";
  });
}

export async function stornoBeantragenAction(id: string): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaub();
    const a = await setzeStatus(id, "genehmigt", "storno_beantragt");
    await notify("storno_beantragt", a);
    return "Storno beantragt.";
  });
}

// ─── Admin/CEO: Entscheidungen ───────────────────────────────────────────────

export type Entscheidung = "genehmigen" | "ablehnen" | "storno_bestaetigen" | "storno_ablehnen";

export async function entscheidenAction(id: string, entscheidung: Entscheidung, begruendung: string): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const antrag = await getAntrag(id);
    if (!antrag) throw new UrlaubError("Antrag nicht gefunden.");
    switch (entscheidung) {
      case "genehmigen": {
        const a = await setzeStatus(id, "beantragt", "genehmigt", begruendung);
        await notify("genehmigt", a);
        return "Antrag genehmigt.";
      }
      case "ablehnen": {
        if (!begruendung.trim()) throw new UrlaubError("Beim Ablehnen ist eine Begründung Pflicht.");
        const a = await setzeStatus(id, "beantragt", "abgelehnt", begruendung);
        await notify("abgelehnt", a);
        return "Antrag abgelehnt.";
      }
      case "storno_bestaetigen": {
        const a = await setzeStatus(id, "storno_beantragt", "storniert", begruendung);
        await notify("storniert", a);
        return "Storno bestätigt.";
      }
      case "storno_ablehnen": {
        const a = await setzeStatus(id, "storno_beantragt", "genehmigt", begruendung);
        await notify("storno_abgelehnt", a);
        return "Storno abgelehnt – der Urlaub bleibt genehmigt.";
      }
    }
  });
}

// ─── Admin/CEO: Konten ───────────────────────────────────────────────────────

export async function kontoSpeichernAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const jahr = zahl(formData, "jahr");
    if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) throw new UrlaubError("Ungültiges Jahr.");
    const verfall = str(formData, "uebertrag_verfall");
    if (verfall && !istISO(verfall)) throw new UrlaubError("Ungültiges Verfallsdatum.");
    await speichereKontingent({
      employee_id: str(formData, "employee_id"),
      jahr,
      anspruch: zahl(formData, "anspruch"),
      uebertrag: zahl(formData, "uebertrag"),
      uebertrag_verfall: verfall || null,
      korrektur: zahl(formData, "korrektur"),
      korrektur_notiz: str(formData, "korrektur_notiz") || null,
    });
    return "Konto gespeichert.";
  });
}

/** Übertrag des Jahres := Rest des Vorjahres zum 31.12. (Vorschlag, vom Admin ausgelöst). */
export async function uebertragBerechnenAction(employeeId: string, jahr: number): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const [konten, antraege, muster, ferien] = await Promise.all([
      listKontingente(employeeId),
      listAntraege(employeeId),
      listArbeitsmuster(employeeId),
      listBetriebsferien(),
    ]);
    const vorjahr = konten.find((k) => k.jahr === jahr - 1);
    if (!vorjahr) throw new UrlaubError(`Für ${jahr - 1} gibt es kein Konto – Übertrag bitte von Hand eintragen.`);
    const vorschlag = uebertragVorschlag({ jahr: jahr - 1, kontingent: vorjahr, antraege, muster, betriebsferien: ferien });
    const aktuell = konten.find((k) => k.jahr === jahr);
    await speichereKontingent({
      employee_id: employeeId,
      jahr,
      anspruch: aktuell?.anspruch ?? 0,
      uebertrag: vorschlag,
      uebertrag_verfall: aktuell?.uebertrag_verfall ?? null,
      korrektur: aktuell?.korrektur ?? 0,
      korrektur_notiz: aktuell?.korrektur_notiz ?? null,
    });
    return `Übertrag ${jahr}: ${String(vorschlag).replace(".", ",")} Tage übernommen.`;
  });
}

// ─── Admin/CEO: Einstellungen ────────────────────────────────────────────────

export async function paarAnlegenAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    await legePaarAn(str(formData, "a"), str(formData, "b"));
    return "Konfliktpaar gespeichert.";
  });
}
export async function paarLoeschenAction(id: string): Promise<UrlaubResult> {
  return run(async () => { await requireUrlaubAdmin(); await loeschePaar(id); });
}

export async function sperreAnlegenAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const titel = str(formData, "titel");
    if (!titel) throw new UrlaubError("Bitte einen Titel angeben.");
    const von = datum(formData, "von", "den Anfang");
    const bis = datum(formData, "bis", "das Ende");
    if (bis < von) throw new UrlaubError("Das Ende liegt vor dem Anfang.");
    await legeSperreAn({ von, bis, titel });
    return "Urlaubssperre gespeichert.";
  });
}
export async function sperreLoeschenAction(id: string): Promise<UrlaubResult> {
  return run(async () => { await requireUrlaubAdmin(); await loescheSperre(id); });
}

export async function betriebsferienAnlegenAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const titel = str(formData, "titel");
    if (!titel) throw new UrlaubError("Bitte einen Titel angeben.");
    const von = datum(formData, "von", "den Anfang");
    const bis = datum(formData, "bis", "das Ende");
    if (bis < von) throw new UrlaubError("Das Ende liegt vor dem Anfang.");
    await legeBetriebsferienAn({ von, bis, titel, zaehlt_als_urlaub: formData.get("zaehlt_als_urlaub") === "on" });
    return "Betriebsferien gespeichert.";
  });
}
export async function betriebsferienLoeschenAction(id: string): Promise<UrlaubResult> {
  return run(async () => { await requireUrlaubAdmin(); await loescheBetriebsferien(id); });
}

export async function musterSpeichernAction(formData: FormData): Promise<UrlaubResult> {
  return run(async () => {
    await requireUrlaubAdmin();
    const tag = (k: string) => formData.get(k) === "on";
    await speichereMuster({
      employee_id: str(formData, "employee_id"),
      gueltig_ab: datum(formData, "gueltig_ab", "„gültig ab“"),
      mo: tag("mo"), di: tag("di"), mi: tag("mi"), do: tag("do"), fr: tag("fr"), sa: tag("sa"), so: tag("so"),
    });
    return "Arbeitsmuster gespeichert.";
  });
}
export async function musterLoeschenAction(id: string): Promise<UrlaubResult> {
  return run(async () => { await requireUrlaubAdmin(); await loescheMuster(id); });
}
