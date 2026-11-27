import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/20261129_abnahme_fotolink.sql", import.meta.url), "utf8");
const fn = sql.slice(sql.indexOf("create or replace function public.abnahme_guard_protokoll"));
const ausnahmen = (block: string) => [...block.matchAll(/- '([a-z_]+)'/g)].map((m) => m[1]);

test("Sperr-Trigger: nur pdf_path, Adressen, technische Felder und public_* sind nach Abschluss änderbar", () => {
  const erste = ausnahmen(fn.split("is distinct from")[0]);
  const zweite = ausnahmen(fn.split("is distinct from")[1].split("then")[0]);
  const erlaubt = ["pdf_path", "kunde_email", "kopie_email", "updated_at", "checkout_device", "checkout_user", "checkout_at", "rev", "public_token", "public_aktiv", "public_erstellt_at", "public_widerrufen_at"];
  assert.deepEqual([...erste].sort(), [...erlaubt].sort());
  assert.deepEqual(zweite, erste, "alte und neue Zeile müssen dieselben Spalten ausnehmen");
  for (const gesperrt of ["status", "kunde", "kommission_nr", "version", "abgeschlossen_at", "bemerkung"]) assert.ok(!erste.includes(gesperrt), gesperrt);
});

test("Token-Format in der Migration entspricht dem Client-Format", () => {
  assert.match(sql, /\^\[A-Za-z0-9_-\]\{32,64\}\$/);
});
