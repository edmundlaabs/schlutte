import test from "node:test";
import assert from "node:assert/strict";
import { erzeugePublicToken, istPublicToken, publicUrl, STANDARD_BASIS_URL } from "./public-token.ts";
import { erzeugeNachtrag } from "./nachtrag.ts";
import { docToRows, rowsToDoc } from "./mapping.ts";
import type { ProtokollDoc } from "./types.ts";

test("Token: 32 Zeichen base64url, gültiges Format, eindeutig", () => {
  const set = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const t = erzeugePublicToken();
    assert.equal(t.length, 32);
    assert.ok(istPublicToken(t), t);
    set.add(t);
  }
  assert.equal(set.size, 500);
});

test("Token-Format: zu kurz, falsche Zeichen, kein String", () => {
  assert.equal(istPublicToken("abc"), false);
  assert.equal(istPublicToken("a".repeat(31)), false);
  assert.equal(istPublicToken("a".repeat(32) + "+"), false);
  assert.equal(istPublicToken("a/".repeat(16)), false);
  assert.equal(istPublicToken(null), false);
  assert.equal(istPublicToken("A1_-".repeat(8)), true);
});

test("URL: Basis aus Env/Parameter, ohne doppelten Schrägstrich, Standard nie localhost", () => {
  const t = "A".repeat(32);
  assert.equal(publicUrl(t, "https://x.example/"), `https://x.example/p/${t}`);
  assert.equal(publicUrl(t, ""), `${STANDARD_BASIS_URL}/p/${t}`);
  assert.ok(!STANDARD_BASIS_URL.includes("localhost"));
});

test("Nachtrag übernimmt den Token nicht; Mapping rundet Token hin und zurück", () => {
  const doc: ProtokollDoc = {
    id: "p1", commissionId: null, kommissionNr: "", kunde: "K", projekt: "", titel: "", ort: "", sprache: "de", status: "abgeschlossen",
    quelle: "manuell", version: 1, parentId: null, mitarbeiterId: null, mitarbeiterName: "", teilnehmer: [], kundeEmail: "", kopieEmail: "",
    bemerkung: "", beginnAt: null, abgeschlossenAt: "2026-11-27T10:00:00Z", originalPath: null, pdfPath: "p.pdf", rev: 3,
    raeume: [], positionen: [], maengel: [], fotos: [], objektFotos: [], unterschriften: [],
    publicToken: "B".repeat(32), publicErstelltAt: "2026-11-27T10:00:00Z",
  };
  const rows = docToRows(doc);
  assert.equal(rows.protokoll.public_token, "B".repeat(32));
  const nach = erzeugeNachtrag(doc, [], "p2");
  assert.equal(nach.publicToken, null);
  assert.equal(docToRows(nach).protokoll.public_token, null);
  const zurueck = rowsToDoc(rows);
  assert.equal(zurueck.publicToken, "B".repeat(32));
});
