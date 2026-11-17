#!/usr/bin/env node
/**
 * Lädt die freigegebenen PandaCAD-Dateien in den privaten Bucket "pandacad" und
 * trägt sie in public.pandacad_downloads ein.
 *
 * Voraussetzung: Migration 20261118_pandacad.sql ist ausgeführt; .env.local enthält
 * NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.
 *
 * Aufruf (im Ordner schlutte_develop):
 *   node supabase/upload-pandacad-files.mjs [Quellordner]          # Probelauf (schreibt nichts)
 *   node supabase/upload-pandacad-files.mjs [Quellordner] --write  # hochladen
 *
 * Wiederholbar (Upsert, löscht nichts). Nur die Dateien in FILES — keine Lizenz-/Login-
 * Dokumente, keine Benutzerprofile (.pcadUI), keine .msg/Thumbs.db, keine Installer.
 * Neue Dateien später ohne Code: Zeile in pandacad_downloads + Datei im Bucket.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const sourceDir =
  args.find((a) => !a.startsWith("--")) ??
  "/Users/edmundlaabs/KG/_SHARED/Programmierung/Prgrammierung/PandaCAD/Palette CAD";

const FILES = [
  { file: "Pfade für PaletteCAD.pcadconfig", titel: "Pfade für PaletteCAD (pcadconfig)", beschreibung: "Setzt alle Datenpfade auf R:\\Palette CAD\\Dat\\… — in Palette CAD importieren.", type: "application/octet-stream" },
  { file: "Anleitungen/Updatemanageranleitung.pdf", titel: "Updatemanager-Anleitung", beschreibung: "Updates von Palette CAD einspielen.", type: "application/pdf" },
  { file: "Anleitungen/Home_Pro_Erste_Schritte.pdf", titel: "Home Pro – Erste Schritte", beschreibung: null, type: "application/pdf" },
  { file: "Anleitungen/Palette_Showroom-Erste_Schritte.pdf", titel: "Palette Showroom – Erste Schritte", beschreibung: null, type: "application/pdf" },
  { file: "Anleitungen/Palette_Showroom_PRO.pdf", titel: "Palette Showroom PRO", beschreibung: null, type: "application/pdf" },
  { file: "Anleitungen/PaletteCAD-Online Browser.pdf", titel: "PaletteCAD Online-Browser", beschreibung: null, type: "application/pdf" },
  { file: "Anleitungen/E-Learning-Anmeldung.pdf", titel: "E-Learning-Anmeldung", beschreibung: null, type: "application/pdf" },
];

function fail(m) { console.error(`\nFEHLER: ${m}\n`); process.exit(1); }

function readEnvLocal() {
  const env = {};
  const p = join(repoDir, ".env.local");
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = readEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in .env.local.");

// Speicherpfad im Bucket: ASCII-sicher (Leerzeichen/Umlaute ersetzen).
const safe = (name) => name.replace(/ü/g, "ue").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ß/g, "ss").replace(/[^A-Za-z0-9._-]+/g, "_");

console.log(`${write ? "SCHREIBEN" : "PROBELAUF"} — Quelle: ${sourceDir}\n`);
const plan = FILES.map((f, i) => {
  const abs = join(sourceDir, f.file);
  const ok = existsSync(abs);
  return { ...f, abs, ok, size: ok ? statSync(abs).size : 0, storage_path: safe(f.file.split("/").pop()), reihenfolge: i + 1 };
});
for (const p of plan) console.log(`${p.ok ? "OK     " : "FEHLT  "} ${p.file}  →  pandacad/${p.storage_path}  (${(p.size / 1024).toFixed(0)} KB)`);
if (plan.some((p) => !p.ok)) fail("Nicht alle Dateien gefunden.");
if (!write) { console.log("\nProbelauf beendet. Mit --write hochladen."); process.exit(0); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
for (const p of plan) {
  const { error: upErr } = await supabase.storage.from("pandacad").upload(p.storage_path, readFileSync(p.abs), { upsert: true, contentType: p.type });
  if (upErr) fail(`Upload ${p.file}: ${upErr.message}`);
  const { error: dbErr } = await supabase.from("pandacad_downloads").upsert(
    { titel: p.titel, beschreibung: p.beschreibung, storage_path: p.storage_path, reihenfolge: p.reihenfolge },
    { onConflict: "storage_path" }
  );
  if (dbErr) fail(`Tabelle ${p.file}: ${dbErr.message}`);
  console.log(`hochgeladen: ${p.storage_path}`);
}
console.log("\nFertig.");
