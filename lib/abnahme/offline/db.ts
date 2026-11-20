import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ProtokollDoc, RegieDoc } from "../types.ts";

/**
 * Lokaler Speicher der Begehung (IndexedDB). Jede Eingabe wird sofort geschrieben.
 * - docs:  komplettes Dokument + Sync-Zustand
 * - blobs: Fotos (JPEG) und Unterschriften (PNG), bis sie hochgeladen sind
 * - meta:  Gerät-ID, angemeldeter Nutzer, Vorlagen, Mitarbeiterliste
 */

export type SyncZustand = "lokal" | "synchronisiert" | "fehler";

export type VersandVormerkung = { an: string; kopie: string; schluessel: string };

export type LokalesDokument =
  | {
      id: string;
      typ: "abnahme";
      doc: ProtokollDoc;
      dirty: boolean;
      zustand: SyncZustand;
      fehler: string;
      geladenAt: string;
      syncedAt: string | null;
      versand: VersandVormerkung[];
      /** Zähler jeder lokalen Änderung (erkennt Änderungen während eines laufenden Syncs). */
      editSeq: number;
    }
  | {
      id: string;
      typ: "regie";
      doc: RegieDoc;
      dirty: boolean;
      zustand: SyncZustand;
      fehler: string;
      geladenAt: string;
      syncedAt: string | null;
      versand: VersandVormerkung[];
      /** Zähler jeder lokalen Änderung (erkennt Änderungen während eines laufenden Syncs). */
      editSeq: number;
    };

export type LokalerBlob = { id: string; docId: string; art: "foto" | "unterschrift" | "pdf"; mime: string; blob: Blob; hochgeladen: boolean };

export type Meta = {
  me: { id: string | null; name: string } | null;
  vorlagen: unknown[];
  employees: { id: string; name: string }[];
};

interface Schema extends DBSchema {
  docs: { key: string; value: LokalesDokument };
  blobs: { key: string; value: LokalerBlob; indexes: { docId: string } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>("schlutte-abnahme", 1, {
      upgrade(d) {
        d.createObjectStore("docs", { keyPath: "id" });
        const blobs = d.createObjectStore("blobs", { keyPath: "id" });
        blobs.createIndex("docId", "docId");
        d.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

export async function alleDokumente(): Promise<LokalesDokument[]> {
  return (await db()).getAll("docs");
}
export async function holeDokument(id: string): Promise<LokalesDokument | undefined> {
  return (await db()).get("docs", id);
}
export async function speichereDokument(d: LokalesDokument): Promise<void> {
  await (await db()).put("docs", d);
}
export async function loescheDokument(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["docs", "blobs"], "readwrite");
  await tx.objectStore("docs").delete(id);
  const keys = await tx.objectStore("blobs").index("docId").getAllKeys(id);
  for (const k of keys) await tx.objectStore("blobs").delete(k);
  await tx.done;
}

export async function speichereBlob(b: LokalerBlob): Promise<void> {
  await (await db()).put("blobs", b);
}
export async function holeBlob(id: string): Promise<LokalerBlob | undefined> {
  return (await db()).get("blobs", id);
}
export async function loescheBlob(id: string): Promise<void> {
  await (await db()).delete("blobs", id);
}
export async function blobsDesDokuments(docId: string): Promise<LokalerBlob[]> {
  return (await db()).getAllFromIndex("blobs", "docId", docId);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key)) as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put("meta", value, key);
}

/** Zufällige, geräteeigene ID für den Checkout (bleibt in IndexedDB). */
export async function geraeteId(): Promise<string> {
  const vorhanden = await getMeta<string>("deviceId");
  if (vorhanden) return vorhanden;
  const neu = crypto.randomUUID();
  await setMeta("deviceId", neu);
  return neu;
}
