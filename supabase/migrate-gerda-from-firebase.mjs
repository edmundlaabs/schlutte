#!/usr/bin/env node
/**
 * Einmaliger Datenumzug Gerda: Firebase/Firestore → Supabase (Tabellen gerda_*).
 *
 * Voraussetzungen:
 *   - Migrationen 20261116_app_access.sql und 20261117_gerda_tables.sql sind ausgeführt.
 *   - .env.local enthält NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.
 *   - Service-Account-Schlüssel des Gerda-Firebase-Projekts als JSON-Datei
 *     (Firebase Console → Projekteinstellungen → Dienstkonten → Neuen privaten
 *     Schlüssel generieren). Datei NICHT ins Repo legen, nach dem Umzug löschen.
 *
 * Aufruf (im Ordner schlutte_develop):
 *   node supabase/migrate-gerda-from-firebase.mjs /pfad/zum/schluessel.json           # Probelauf
 *   node supabase/migrate-gerda-from-firebase.mjs /pfad/zum/schluessel.json --write   # schreibt
 *
 * Der Probelauf liest nur, zeigt Zahlen und schreibt ein JSON-Backup neben das Repo.
 * --write ist wiederholbar (Upsert per Primärschlüssel), löscht nichts in Supabase
 * und verändert Firebase nie.
 */
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const keyPath = args.find((a) => !a.startsWith("--"));

function fail(message) {
  console.error(`\nFEHLER: ${message}\n`);
  process.exit(1);
}

if (!keyPath) fail("Pfad zur Service-Account-JSON fehlt. Aufruf siehe Kopf dieser Datei.");

// ── Konfiguration ────────────────────────────────────────────────────────────
function readEnvLocal() {
  const env = {};
  let text = "";
  try {
    text = readFileSync(resolve(repoDir, ".env.local"), "utf8");
  } catch {
    fail(".env.local nicht gefunden (im Ordner schlutte_develop erwartet).");
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

const env = readEnvLocal();
const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  fail("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local.");
}

let sa;
try {
  sa = JSON.parse(readFileSync(resolve(keyPath), "utf8"));
} catch {
  fail(`Service-Account-Datei nicht lesbar: ${keyPath}`);
}
if (!sa.project_id || !sa.client_email || !sa.private_key) {
  fail("Service-Account-Datei unvollständig (project_id, client_email, private_key erwartet).");
}

// ── Firestore lesen ──────────────────────────────────────────────────────────
const b64url = (v) => Buffer.from(v).toString("base64url");

async function googleToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    fail(`Google-Anmeldung fehlgeschlagen: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token;
}

export function decodeValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  if ("referenceValue" in v) return v.referenceValue;
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields ?? {})) out[key] = decodeValue(value);
  return out;
}

async function readCollection(token, name) {
  const docs = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ pageSize: "300" });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${name}?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) fail(`Firestore-Sammlung "${name}" nicht lesbar: ${data.error?.message ?? res.status}`);
    for (const doc of data.documents ?? []) {
      docs.push({
        id: decodeURIComponent(doc.name.split("/").pop()),
        createTime: doc.createTime ?? null,
        data: decodeFields(doc.fields),
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

// ── Abbildung Firestore → Tabellenzeilen ─────────────────────────────────────
const str = (v, fallback = "") => (v == null ? fallback : String(v));
const strOrNull = (v) => (v == null ? null : String(v));
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const MAPPINGS = {
  tasks: {
    table: "gerda_tasks",
    pk: "id",
    known: ["id", "person", "kommissionsNummer", "kunde", "priorisierung", "bezeichnung", "aufgabe", "createdAt", "eingetragenAm", "deadline", "erledigt", "order", "parentId"],
    toRow: ({ id, data: d }) => ({
      id: str(d.id, id),
      person: str(d.person),
      kommissions_nummer: str(d.kommissionsNummer),
      kunde: str(d.kunde),
      priorisierung: [1, 2, 3].includes(Number(d.priorisierung)) ? Number(d.priorisierung) : 2,
      bezeichnung: str(d.bezeichnung),
      aufgabe: str(d.aufgabe),
      created_at: strOrNull(d.createdAt),
      eingetragen_am: strOrNull(d.eingetragenAm),
      deadline: strOrNull(d.deadline),
      erledigt: d.erledigt === true,
      sort_order: numOrNull(d.order),
      parent_id: strOrNull(d.parentId),
    }),
  },
  persons: {
    table: "gerda_persons",
    pk: "name",
    known: ["active", "shortName", "name"],
    toRow: ({ id, data: d }) => ({
      name: id,
      active: d.active !== false,
      short_name: str(d.shortName),
    }),
  },
  customers: {
    table: "gerda_customers",
    pk: "name",
    known: ["name"],
    toRow: ({ id, data: d }) => ({ name: str(d.name, id) }),
  },
  feedback: {
    table: "gerda_feedback",
    pk: "id",
    known: ["id", "text", "createdAt", "reply", "erledigt"],
    toRow: ({ id, data: d }) => ({
      id: str(d.id, id),
      text: str(d.text),
      created_at: strOrNull(d.createdAt),
      reply: strOrNull(d.reply),
      erledigt: d.erledigt === true,
    }),
  },
};

// ── Supabase schreiben ───────────────────────────────────────────────────────
const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function upsert(table, pk, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${pk}`, {
      method: "POST",
      headers: {
        ...sbHeaders,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) {
      const text = await res.text();
      fail(`Schreiben in ${table} fehlgeschlagen (${res.status}): ${text}\nSind die Migrationen ausgeführt?`);
    }
  }
}

async function countRows(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { ...sbHeaders, Prefer: "count=exact" },
  });
  if (!res.ok) return null;
  const total = (res.headers.get("content-range") ?? "").split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}

// ── Ablauf ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Firebase-Projekt: ${sa.project_id}`);
  console.log(`Supabase:         ${SUPABASE_URL}`);
  console.log(write ? "Modus:            SCHREIBEN (--write)\n" : "Modus:            Probelauf (nur lesen)\n");

  const token = await googleToken();
  const backup = {};
  const plan = [];

  for (const [collection, mapping] of Object.entries(MAPPINGS)) {
    const docs = await readCollection(token, collection);
    backup[collection] = docs;

    const byPk = new Map();
    const unknown = new Set();
    for (const doc of docs) {
      for (const key of Object.keys(doc.data)) if (!mapping.known.includes(key)) unknown.add(key);
      const row = mapping.toRow(doc);
      byPk.set(row[mapping.pk], row); // doppelte Schlüssel: letzter gewinnt
    }
    const rows = [...byPk.values()];
    plan.push({ collection, mapping, rows });

    const dup = docs.length - rows.length;
    console.log(
      `${collection.padEnd(10)} ${String(docs.length).padStart(5)} Dokumente → ${mapping.table}` +
        (dup ? `  (${dup} doppelte Schlüssel zusammengeführt)` : "") +
        (unknown.size ? `  ! nicht übernommene Felder: ${[...unknown].join(", ")}` : "")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const backupPath = resolve(repoDir, "..", `gerda-firebase-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup geschrieben: ${backupPath}`);

  if (!write) {
    console.log("\nProbelauf beendet — nichts wurde in Supabase geschrieben. Mit --write ausführen, um zu übernehmen.");
    return;
  }

  console.log("");
  for (const { mapping, rows } of plan) {
    if (rows.length) await upsert(mapping.table, mapping.pk, rows);
    const total = await countRows(mapping.table);
    const ok = total != null && total >= rows.length;
    console.log(
      `${mapping.table.padEnd(16)} ${String(rows.length).padStart(5)} übertragen, ${total ?? "?"} Zeilen in Supabase ${ok ? "✓" : "— BITTE PRÜFEN"}`
    );
  }
  console.log("\nUmzug abgeschlossen. Firebase wurde nicht verändert.");
}

// Nur ausführen, wenn direkt gestartet (nicht beim Import in Tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail(e?.message ?? String(e)));
}
