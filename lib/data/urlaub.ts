import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveEmployees } from "@/lib/data/employees";
import { dbFehler, UrlaubError } from "@/lib/urlaub/fehler";
import { berechneTage } from "@/lib/urlaub/tage";
import { berechneKonto } from "@/lib/urlaub/konto";
import { addDays, istISO, heuteISO, ueberschneiden } from "@/lib/urlaub/datum";
import {
  AKTIVE_STATUS,
  type Antrag,
  type Antragsart,
  type Antragsstatus,
  type ArbeitsmusterEintrag,
  type Betriebsferien,
  type Konfliktpaar,
  type Kontingent,
  type ProtokollEintrag,
  type Sperre,
} from "@/lib/urlaub/types";
import { sortiertesPaar } from "@/lib/urlaub/konflikte";

/**
 * Datenzugriff Urlaub. Lesen und die meisten Schreibzugriffe laufen mit der Sitzung des Nutzers
 * (RLS + Trigger der Migration 20261118_urlaub.sql). Nur das Anlegen eines Antrags nutzt den
 * Service-Role-Key, weil `tage` serverseitig berechnet werden muss und Mitarbeiter keine INSERT-Policy haben.
 */

export type MitarbeiterKurz = { id: string; name: string; initials: string };

export async function listMitarbeiter(): Promise<MitarbeiterKurz[]> {
  const list = await getActiveEmployees();
  return list
    .filter((e): e is typeof e & { id: string } => !!e.id)
    .map((e) => ({ id: e.id, name: e.name, initials: e.initials ?? e.kuerzel }));
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function toAntrag(r: Record<string, unknown>): Antrag {
  return { ...(r as unknown as Antrag), tage: num(r.tage) };
}

function toKontingent(r: Record<string, unknown>): Kontingent {
  return {
    ...(r as unknown as Kontingent),
    jahr: num(r.jahr),
    anspruch: num(r.anspruch),
    uebertrag: num(r.uebertrag),
    korrektur: num(r.korrektur),
  };
}

// ─── Lesen ───────────────────────────────────────────────────────────────────

/** Anträge: eigene (employeeId) oder alle (RLS lässt Nicht-Admins nur eigene durch). */
export async function listAntraege(employeeId?: string): Promise<Antrag[]> {
  const supabase = await createClient();
  let q = supabase.from("urlaub_antraege").select("*").order("von", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw dbFehler(error, "Anträge konnten nicht geladen werden");
  return (data ?? []).map(toAntrag);
}

export async function getAntrag(id: string): Promise<Antrag | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("urlaub_antraege").select("*").eq("id", id).maybeSingle();
  if (error) throw dbFehler(error, "Antrag konnte nicht geladen werden");
  return data ? toAntrag(data) : null;
}

export async function listKontingente(employeeId?: string): Promise<Kontingent[]> {
  const supabase = await createClient();
  let q = supabase.from("urlaub_kontingente").select("*");
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw dbFehler(error, "Urlaubskonten konnten nicht geladen werden");
  return (data ?? []).map(toKontingent);
}

export type MusterZeile = ArbeitsmusterEintrag & { id: string; employee_id: string };

export async function listArbeitsmuster(employeeId?: string): Promise<MusterZeile[]> {
  const supabase = await createClient();
  let q = supabase.from("urlaub_arbeitsmuster").select("*").order("gueltig_ab");
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw dbFehler(error, "Arbeitsmuster konnten nicht geladen werden");
  return (data ?? []) as MusterZeile[];
}

export async function listSperren(): Promise<Sperre[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("urlaub_sperren").select("*").order("von");
  if (error) throw dbFehler(error, "Urlaubssperren konnten nicht geladen werden");
  return (data ?? []) as Sperre[];
}

export async function listBetriebsferien(): Promise<Betriebsferien[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("urlaub_betriebsferien").select("*").order("von");
  if (error) throw dbFehler(error, "Betriebsferien konnten nicht geladen werden");
  return (data ?? []) as Betriebsferien[];
}

export async function listKonfliktpaare(): Promise<Konfliktpaar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("urlaub_konfliktpaare").select("*");
  if (error) throw dbFehler(error, "Konfliktpaare konnten nicht geladen werden");
  return (data ?? []) as Konfliktpaar[];
}

export async function listProtokoll(antragId: string): Promise<ProtokollEintrag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("urlaub_protokoll")
    .select("*")
    .eq("antrag_id", antragId)
    .order("created_at");
  if (error) throw dbFehler(error, "Protokoll konnte nicht geladen werden");
  return (data ?? []) as ProtokollEintrag[];
}

export type TeamEintrag = {
  name: string;
  von: string;
  bis: string;
  halbtag_start: boolean;
  halbtag_ende: boolean;
  status: "beantragt" | "genehmigt";
  ist_eigen: boolean;
};

/** Abwesenheiten aller Kollegen (ohne Art/Kommentar) über die DB-Funktion urlaub_team_kalender. */
export async function teamKalender(von: string, bis: string): Promise<TeamEintrag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("urlaub_team_kalender", { p_von: von, p_bis: bis });
  if (error) throw dbFehler(error, "Teamkalender konnte nicht geladen werden");
  return (data ?? []) as TeamEintrag[];
}

/** Anzahl offener Anträge (beantragt + Storno) — für den Zähler auf der Startseite (Admin/CEO). */
export async function zaehleOffene(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("urlaub_antraege")
    .select("id", { count: "exact", head: true })
    .in("status", ["beantragt", "storno_beantragt"]);
  if (error) throw dbFehler(error, "Offene Anträge konnten nicht gezählt werden");
  return count ?? 0;
}

// ─── Antrag anlegen / Status ─────────────────────────────────────────────────

export type NeuerAntrag = {
  art: Antragsart;
  von: string;
  bis: string;
  halbtagStart: boolean;
  halbtagEnde: boolean;
  kommentar: string;
};

/**
 * Legt einen Antrag an. Berechnet `tage` serverseitig (Arbeitsmuster, Feiertage, Betriebsferien)
 * und schreibt mit dem Service-Role-Key. Aufrufer hat Zugriff/Identität bereits geprüft.
 */
export async function legeAntragAn(employeeId: string, input: NeuerAntrag): Promise<Antrag> {
  if (input.art === "krank") throw new UrlaubError("Krankmeldungen sind noch nicht möglich.");
  if (!["urlaub", "ueberstunden", "sonder"].includes(input.art)) throw new UrlaubError("Bitte eine Art wählen.");
  if (!istISO(input.von) || !istISO(input.bis)) throw new UrlaubError("Bitte Anfang und Ende des Zeitraums angeben.");
  if (input.bis < input.von) throw new UrlaubError("Das Ende liegt vor dem Anfang.");
  const heute = heuteISO();
  if (input.von < addDays(heute, -366) || input.bis > addDays(heute, 800) || input.bis > addDays(input.von, 366)) {
    throw new UrlaubError("Der Zeitraum ist nicht plausibel (maximal ein Jahr).");
  }

  const [muster, ferien, eigene] = await Promise.all([
    listArbeitsmuster(employeeId),
    listBetriebsferien(),
    listAntraege(employeeId),
  ]);
  const tage = berechneTage({
    von: input.von,
    bis: input.bis,
    halbtagStart: input.halbtagStart,
    halbtagEnde: input.halbtagEnde,
    muster,
    betriebsferien: ferien,
  });
  if (tage <= 0) {
    throw new UrlaubError("Im gewählten Zeitraum liegen keine Arbeitstage (Wochenende, Feiertage oder Betriebsferien).");
  }
  const doppelt = eigene.find((a) => AKTIVE_STATUS.includes(a.status) && ueberschneiden(a, input));
  if (doppelt) throw new UrlaubError("Der Zeitraum überschneidet sich mit einem deiner bestehenden Anträge.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("urlaub_antraege")
    .insert({
      employee_id: employeeId,
      art: input.art,
      von: input.von,
      bis: input.bis,
      halbtag_start: input.halbtagStart,
      halbtag_ende: input.halbtagEnde,
      tage,
      status: "beantragt",
      kommentar: input.kommentar.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw dbFehler(error, "Antrag konnte nicht gespeichert werden");
  return toAntrag(data);
}

/**
 * Statuswechsel mit der Sitzung des Nutzers (RLS + Trigger entscheiden, ob er erlaubt ist).
 * `erwartet` verhindert, dass ein bereits anders entschiedener Antrag überschrieben wird.
 */
export async function setzeStatus(
  id: string,
  erwartet: Antragsstatus,
  neu: Antragsstatus,
  begruendung?: string,
): Promise<Antrag> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: neu };
  if (begruendung !== undefined) patch.begruendung = begruendung.trim() || null;
  const { data, error } = await supabase
    .from("urlaub_antraege")
    .update(patch)
    .eq("id", id)
    .eq("status", erwartet)
    .select("*")
    .maybeSingle();
  if (error) throw dbFehler(error, "Status konnte nicht geändert werden");
  if (!data) throw new UrlaubError("Der Antrag wurde inzwischen geändert oder ist nicht mehr verfügbar. Bitte Seite neu laden.");
  return toAntrag(data);
}

// ─── Verwaltung: Konten, Muster, Einstellungen (RLS: nur CEO/Admin) ──────────

export async function speichereKontingent(k: {
  employee_id: string;
  jahr: number;
  anspruch: number;
  uebertrag: number;
  uebertrag_verfall: string | null;
  korrektur: number;
  korrektur_notiz: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_kontingente").upsert(
    { ...k, uebertrag_verfall: k.uebertrag_verfall ?? `${k.jahr}-03-31` },
    { onConflict: "employee_id,jahr" },
  );
  if (error) throw dbFehler(error, "Konto konnte nicht gespeichert werden");
}

export async function speichereMuster(m: ArbeitsmusterEintrag & { employee_id: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("urlaub_arbeitsmuster")
    .upsert(m, { onConflict: "employee_id,gueltig_ab" });
  if (error) throw dbFehler(error, "Arbeitsmuster konnte nicht gespeichert werden");
}

export async function loescheMuster(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_arbeitsmuster").delete().eq("id", id);
  if (error) throw dbFehler(error, "Arbeitsmuster konnte nicht gelöscht werden");
}

export async function legePaarAn(a: string, b: string): Promise<void> {
  if (a === b) throw new UrlaubError("Bitte zwei verschiedene Mitarbeiter wählen.");
  const [x, y] = sortiertesPaar(a, b);
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_konfliktpaare").insert({ employee_a: x, employee_b: y });
  if (error) throw dbFehler(error, "Konfliktpaar konnte nicht gespeichert werden");
}

export async function loeschePaar(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_konfliktpaare").delete().eq("id", id);
  if (error) throw dbFehler(error, "Konfliktpaar konnte nicht gelöscht werden");
}

export async function legeSperreAn(s: Omit<Sperre, "id">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_sperren").insert(s);
  if (error) throw dbFehler(error, "Urlaubssperre konnte nicht gespeichert werden");
}

export async function loescheSperre(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_sperren").delete().eq("id", id);
  if (error) throw dbFehler(error, "Urlaubssperre konnte nicht gelöscht werden");
}

export async function legeBetriebsferienAn(b: Omit<Betriebsferien, "id">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_betriebsferien").insert(b);
  if (error) throw dbFehler(error, "Betriebsferien konnten nicht gespeichert werden");
}

export async function loescheBetriebsferien(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("urlaub_betriebsferien").delete().eq("id", id);
  if (error) throw dbFehler(error, "Betriebsferien konnten nicht gelöscht werden");
}

// ─── Startseiten-Widget ──────────────────────────────────────────────────────

export type StartWidgetDaten = {
  jahr: number;
  rest: number;
  offeneEigene: Antrag[];
  naechste: Antrag | null;
  /** Nur CEO/Admin: Anzahl offener Anträge (beantragt + Storno). */
  offeneGesamt: number | null;
};

/** Daten für das Startseiten-Widget. Gibt bei Fehlern (z. B. Migration fehlt) null zurück – die Startseite darf nie daran scheitern. */
export async function ladeStartWidget(employeeId: string, istAdmin: boolean): Promise<StartWidgetDaten | null> {
  try {
    const heute = heuteISO();
    const jahr = Number(heute.slice(0, 4));
    const [antraege, kontingente, muster, ferien, offeneGesamt] = await Promise.all([
      listAntraege(employeeId),
      listKontingente(employeeId),
      listArbeitsmuster(employeeId),
      listBetriebsferien(),
      istAdmin ? zaehleOffene() : Promise.resolve(null),
    ]);
    const konto = berechneKonto({
      jahr,
      kontingent: kontingente.find((k) => k.jahr === jahr) ?? null,
      antraege,
      muster,
      betriebsferien: ferien,
      heute,
    });
    const naechste =
      antraege
        .filter((a) => (a.status === "genehmigt" || a.status === "storno_beantragt") && a.bis >= heute)
        .sort((a, b) => a.von.localeCompare(b.von))[0] ?? null;
    return {
      jahr,
      rest: konto.rest,
      offeneEigene: antraege.filter((a) => a.status === "beantragt" || a.status === "storno_beantragt"),
      naechste,
      offeneGesamt,
    };
  } catch (e) {
    console.error("Urlaub-Widget konnte nicht geladen werden:", e);
    return null;
  }
}
