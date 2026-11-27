import test from "node:test";
import assert from "node:assert/strict";
import { wendeUmleitungAn } from "./send.ts";

test("ohne Umleitung: Empfänger und gültiges BCC bleiben", () => {
  const r = wendeUmleitungAn({ to: " kunde@example.com ", bcc: ["a@b.de", "kaputt"], subject: "Betreff" }, null);
  assert.equal(r.to, "kunde@example.com");
  assert.deepEqual(r.bcc, ["a@b.de"]);
  assert.equal(r.subject, "Betreff");
  assert.equal(r.umgeleitetAn, undefined);
});

test("mit Umleitung: nur Testadresse, kein BCC, Betreff mit ursprünglichem Empfänger", () => {
  const r = wendeUmleitungAn({ to: "kunde@example.com", bcc: ["intern@example.com"], subject: "Betreff" }, "test@example.org");
  assert.equal(r.to, "test@example.org");
  assert.equal(r.bcc, undefined);
  assert.equal(r.subject, "[TEST → kunde@example.com] Betreff");
  assert.equal(r.umgeleitetAn, "test@example.org");
});
