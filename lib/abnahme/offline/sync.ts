import { createClient } from "@/lib/supabase/client";
import {
  alleDokumente, blobsDesDokuments, geraeteId, holeDokument, loescheDokument, setMeta,
  speichereBlob, speichereDokument, type LokalesDokument,
} from "./db";
import { fordereDauerhaftenSpeicher, precacheShell } from "./sw-register";
import type { ProtokollDoc, RegieDoc } from "../types";
import { berechneAenderungen, fuehreZusammen, type Wahlen } from "../abgleich";
import { berechneRegieAenderungen, fuehreRegieZusammen } from "../regie-abgleich";

export const SYNC_EVENT = "abnahme-sync";
const notify = () => typeof window !== "undefined" && window.dispatchEvent(new Event(SYNC_EVENT));

type ApiFehler = { ok: false; error: string; daten?: Record<string, unknown> };

async function post<T>(url: string, body: unknown): Promise<(T & { ok: true }) | (ApiFehler & { status: number })> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.redirected || res.status === 401) return { ok: false, error: "Bitte erneut anmelden.", status: 401 };
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return { ok: false, error: json?.error ?? `Fehler ${res.status}`, status: res.status, daten: json ?? undefined };
    return json as T & { ok: true };
  } catch {
    return { ok: false, error: "Keine Verbindung.", status: 0 };
  }
}

export const istOnline = () => typeof navigator === "undefined" || navigator.onLine;

const klon = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Bilder und Unterschriften eines Stands, die lokal noch fehlen, über signierte URLs holen (Offline-Nutzung, PDF). */
async function holeBilder(doc: ProtokollDoc, signed: Record<string, string>): Promise<void> {
  const vorhanden = new Set((await blobsDesDokuments(doc.id)).map((b) => b.id));
  const holen: { id: string; art: "foto" | "unterschrift"; path: string }[] = [
    ...doc.fotos.filter((f) => f.path).map((f) => ({ id: f.id, art: "foto" as const, path: f.path! })),
    ...(doc.objektFotos ?? []).filter((f) => f.path).map((f) => ({ id: f.id, art: "foto" as const, path: f.path! })),
    ...doc.unterschriften.filter((u) => u.bildPath).map((u) => ({ id: u.id, art: "unterschrift" as const, path: u.bildPath! })),
  ].filter((h) => !vorhanden.has(h.id));
  for (const h of holen) {
    const url = signed[h.path];
    if (!url) continue;
    try {
      const blob = await (await fetch(url)).blob();
      await speichereBlob({ id: h.id, docId: doc.id, art: h.art, mime: blob.type, blob, hochgeladen: true });
    } catch {
      /* Bild fehlt lokal; PDF nutzt dann den Platzhalter */
    }
  }
}

/** „Für Baustelle laden“: Dokument samt Bildern, Vorlagen und Mitarbeiterliste lokal speichern (Regiebericht: auschecken). */
export async function ladeFuerBaustelle(typ: "abnahme" | "regie", id: string, force = false): Promise<{ ok: true } | { ok: false; error: string; konflikt?: boolean }> {
  const deviceId = await geraeteId();
  const res = await post<Record<string, unknown>>("/api/abnahme/laden", { typ, id, deviceId, force });
  if (!res.ok) return { ok: false, error: res.error, konflikt: res.status === 409 };
  await setMeta("me", res.me);
  await setMeta("vorlagen", res.vorlagen);
  await setMeta("employees", res.employees);

  if (typ === "abnahme") {
    const doc = res.doc as ProtokollDoc;
    // Bereits hochgeladene Bilder für die Offline-Nutzung holen.
    await holeBilder(doc, (res.signed ?? {}) as Record<string, string>);
    const vorhanden = await holeDokument(doc.id);
    await speichereDokument({
      id: doc.id, typ: "abnahme", doc, dirty: false, zustand: "synchronisiert", fehler: "",
      geladenAt: new Date().toISOString(), syncedAt: new Date().toISOString(),
      versand: vorhanden?.versand ?? [], editSeq: (vorhanden?.editSeq ?? 0) + 1,
      basis: klon(doc), konflikt: null, archiv: null,
    });
  } else {
    const { speichereRegieAusServer } = await import("./regie-laden");
    await speichereRegieAusServer(res);
  }
  void fordereDauerhaftenSpeicher();
  void precacheShell();
  notify();
  return { ok: true };
}

function pfadFuer(docId: string, art: "foto" | "unterschrift" | "pdf", id: string, typ: "abnahme" | "regie"): string {
  const basis = typ === "abnahme" ? `protokoll/${docId}` : `regie/${docId}`;
  if (art === "foto") return `${basis}/fotos/${id}.jpg`;
  if (art === "unterschrift") return typ === "regie" ? `${basis}/unterschrift.png` : `${basis}/unterschriften/${id}.png`;
  return typ === "abnahme" ? `${basis}/abnahme.pdf` : `${basis}/regiebericht.pdf`;
}

let laeuft = false;

/** Sync eines Dokuments: Bilder hochladen → Daten senden → Versand ausführen. */
export async function syncDokument(id: string): Promise<{ ok: boolean; error?: string; konflikt?: boolean }> {
  const start = await holeDokument(id);
  if (!start) return { ok: false, error: "Nicht lokal vorhanden." };
  if (!start.dirty && start.zustand === "synchronisiert") return { ok: true };
  if (!istOnline()) return { ok: false, error: "Keine Verbindung." };
  // Steht ein Abgleich aus, wird erst nach der Auswahl des Nutzers weiter synchronisiert.
  if (start.konflikt && !start.archiv) return { ok: false, error: "Abgleich nötig.", konflikt: true };

  const supabase = createClient();
  const deviceId = await geraeteId();
  const fehler = async (msg: string) => {
    const cur = await holeDokument(id);
    if (cur) await speichereDokument({ ...cur, zustand: "fehler", fehler: msg });
    notify();
    return { ok: false as const, error: msg };
  };

  // 1. Bilder und PDF hochladen
  const blobs = (await blobsDesDokuments(id)).filter((b) => !b.hochgeladen);
  const gesetzt = new Map<string, string>();
  for (const b of blobs) {
    const path = pfadFuer(id, b.art, b.id, start.typ);
    const up = await supabase.storage.from("abnahme").upload(path, b.blob, { contentType: b.mime || undefined, upsert: true });
    if (up.error) return fehler(`Upload fehlgeschlagen: ${up.error.message}`);
    await speichereBlob({ ...b, hochgeladen: true });
    gesetzt.set(b.id, path);
  }

  // 2. Pfade in das aktuelle Dokument eintragen (inzwischen evtl. bearbeitet) und Snapshot senden
  const cur = await holeDokument(id);
  if (!cur) return { ok: false, error: "Dokument fehlt." };
  const snapshotSeq = cur.editSeq;
  let payloadDoc = cur.doc;
  if (cur.typ === "abnahme") {
    const doc = cur.doc;
    payloadDoc = {
      ...doc,
      fotos: doc.fotos.map((f) => (gesetzt.has(f.id) ? { ...f, path: gesetzt.get(f.id)! } : f)),
      objektFotos: (doc.objektFotos ?? []).map((f) => (gesetzt.has(f.id) ? { ...f, path: gesetzt.get(f.id)! } : f)),
      unterschriften: doc.unterschriften.map((u) => (gesetzt.has(u.id) ? { ...u, bildPath: gesetzt.get(u.id)! } : u)),
      pdfPath: gesetzt.get(`pdf:${id}`) ?? doc.pdfPath,
    };
  } else {
    const { regiePfadeSetzen } = await import("./regie-laden");
    payloadDoc = regiePfadeSetzen(cur.doc, gesetzt);
  }
  const res = await post<{ rev: number }>("/api/abnahme/sync", {
    typ: cur.typ, deviceId, baseRev: payloadDoc.rev, doc: cur.typ === "abnahme" ? payloadDoc : undefined, regie: cur.typ === "regie" ? payloadDoc : undefined,
    archiv: cur.archiv ?? undefined,
  });
  if (!res.ok) {
    // Der Server-Stand weicht vom letzten gemeinsamen Stand ab: nichts überschreiben, Abgleich anbieten.
    if (res.status === 409 && res.daten?.konflikt) {
      const d = (await holeDokument(id)) ?? cur;
      const konflikt = { server: res.daten.serverDoc, signed: (res.daten.signed ?? {}) as Record<string, string>, erkanntAt: new Date().toISOString() };
      await speichereDokument({ ...d, zustand: "konflikt", fehler: "Abgleich nötig: zwischenzeitlich geändert.", konflikt } as LokalesDokument);
      notify();
      return { ok: false, error: "Abgleich nötig.", konflikt: true };
    }
    return fehler(res.error);
  }

  // 3. Lokal übernehmen; bei Änderungen während des Syncs bleibt das Dokument „dirty“
  const neu = (await holeDokument(id)) ?? cur;
  const unveraendert = neu.editSeq === snapshotSeq;
  const merged = { ...neu, doc: { ...neu.doc, rev: res.rev } } as LokalesDokument;
  if (neu.typ === "abnahme" && merged.typ === "abnahme") {
    merged.doc = {
      ...merged.doc,
      fotos: merged.doc.fotos.map((f) => (gesetzt.has(f.id) ? { ...f, path: gesetzt.get(f.id)! } : f)),
      objektFotos: (merged.doc.objektFotos ?? []).map((f) => (gesetzt.has(f.id) ? { ...f, path: gesetzt.get(f.id)! } : f)),
      unterschriften: merged.doc.unterschriften.map((u) => (gesetzt.has(u.id) ? { ...u, bildPath: gesetzt.get(u.id)! } : u)),
      pdfPath: gesetzt.get(`pdf:${id}`) ?? merged.doc.pdfPath,
    };
  }
  if (neu.typ === "regie" && merged.typ === "regie") {
    const { regiePfadeSetzen } = await import("./regie-laden");
    merged.doc = regiePfadeSetzen(merged.doc, gesetzt);
  }
  await speichereDokument({
    ...merged,
    basis: klon({ ...payloadDoc, rev: res.rev }), konflikt: null, archiv: null,
    dirty: !unveraendert,
    zustand: unveraendert ? "synchronisiert" : "lokal",
    fehler: "",
    syncedAt: new Date().toISOString(),
    editSeq: neu.editSeq,
  } as LokalesDokument);
  notify();

  // 4. Vorgemerkte Mails (nur nach erfolgreichem Sync)
  const { fuehreVersandAus } = await import("./versand");
  await fuehreVersandAus(id);
  return { ok: true };
}

export async function syncAlle(): Promise<void> {
  if (laeuft || !istOnline()) return;
  laeuft = true;
  try {
    for (const d of await alleDokumente()) {
      if (d.konflikt && !d.archiv) continue; // wartet auf den Abgleich
      if (d.dirty || d.zustand !== "synchronisiert") await syncDokument(d.id);
    }
  } finally {
    laeuft = false;
  }
}

/** Lokale Kopie entfernen (nur wenn synchronisiert). */
export async function entferneLokal(id: string): Promise<{ ok: boolean; error?: string }> {
  const d = await holeDokument(id);
  if (d && (d.dirty || d.zustand !== "synchronisiert")) return { ok: false, error: "Noch nicht synchronisiert." };
  await loescheDokument(id);
  notify();
  return { ok: true };
}

/** Synchronisiert und entfernt die lokale Kopie (Gerätewechsel). */
export async function gibFrei(typ: "abnahme" | "regie", id: string): Promise<{ ok: boolean; error?: string }> {
  const sync = await syncDokument(id);
  if (!sync.ok) return sync;
  // Es gibt kein Auschecken mehr: nach dem Sync genügt es, die lokale Kopie zu entfernen.
  void typ;
  return entferneLokal(id);
}

/** Lokale Kopie verwerfen, auch wenn nicht synchronisiert (z. B. auf dem Server gelöscht). */
export async function verwerfeLokal(id: string): Promise<void> {
  await loescheDokument(id);
  notify();
}

/**
 * Wendet die Auswahl des Nutzers an: Tablet- und Server-Stand werden zusammengeführt, beide Stände für das Archiv
 * vorgemerkt, danach wird synchronisiert. `ganzerTabletStand`: den Tablet-Stand unverändert übernehmen
 * (bei bereits abgeschlossenem Dokument, dessen PDF schon aus dem Tablet-Stand entstand).
 */
export async function wendeAbgleichAn(id: string, wahlen: Wahlen, ganzerTabletStand = false): Promise<{ ok: boolean; error?: string }> {
  const d = await holeDokument(id);
  if (!d || !d.konflikt) return { ok: false, error: "Kein Abgleich offen." };
  if (d.typ === "abnahme") {
    const lokal = d.doc;
    const server = d.konflikt!.server as ProtokollDoc;
    const w = ganzerTabletStand ? Object.fromEntries(berechneAenderungen(d.basis, lokal, server).map((a) => [a.key, "lokal" as const])) : wahlen;
    const merged = fuehreZusammen(d.basis, lokal, server, w);
    await holeBilder(merged, d.konflikt!.signed);
    await speichereDokument({
      ...d, doc: merged, basis: klon(server), konflikt: null, archiv: { tablet: klon(lokal), server: klon(server) },
      dirty: true, zustand: "lokal", fehler: "", editSeq: d.editSeq + 1,
    });
  } else {
    const lokal = d.doc;
    const server = d.konflikt!.server as RegieDoc;
    const w = ganzerTabletStand ? Object.fromEntries(berechneRegieAenderungen(d.basis, lokal, server).map((a) => [a.key, "lokal" as const])) : wahlen;
    const merged = fuehreRegieZusammen(d.basis, lokal, server, w);
    // Kundenunterschrift des Servers lokal bereitstellen (für PDF/Anzeige), falls sie dort entstand und hier fehlt.
    const sigId = `${id}-sig`;
    const url = merged.unterschriftPath ? d.konflikt!.signed[merged.unterschriftPath] : undefined;
    if (url && !(await blobsDesDokuments(id)).some((b) => b.id === sigId)) {
      try {
        const blob = await (await fetch(url)).blob();
        await speichereBlob({ id: sigId, docId: id, art: "unterschrift", mime: blob.type, blob, hochgeladen: true });
      } catch {
        /* Unterschrift fehlt lokal */
      }
    }
    await speichereDokument({
      ...d, doc: merged, basis: klon(server), konflikt: null, archiv: { tablet: klon(lokal), server: klon(server) },
      dirty: true, zustand: "lokal", fehler: "", editSeq: d.editSeq + 1,
    });
  }
  notify();
  return syncDokument(id);
}
