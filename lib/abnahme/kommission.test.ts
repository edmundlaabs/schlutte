import test from "node:test";
import assert from "node:assert/strict";
import { auswahlAusDoc, hatKommission, kommissionAnzeige, validiereKundeKommission, wendeAuswahlAn } from "./kommission.ts";
import { validiereNeuesProtokoll } from "./validate.ts";
import { docToRows, rowsToDoc, zuQuelle } from "./mapping.ts";
import type { ProtokollDoc } from "./types.ts";

const basis = (): ProtokollDoc => ({
  id: "p1", commissionId: null, kommissionNr: "", kunde: "", projekt: "", titel: "", ort: "", sprache: "de",
  status: "bereit", quelle: "manuell", version: 1, parentId: null, mitarbeiterId: null, mitarbeiterName: "",
  teilnehmer: [], kundeEmail: "", kopieEmail: "", bemerkung: "", beginnAt: null, abgeschlossenAt: null,
  originalPath: null, pdfPath: null, rev: 0, raeume: [], positionen: [], maengel: [], fotos: [], unterschriften: [],
});
const mitPosition = (): ProtokollDoc => ({
  ...basis(),
  raeume: [{ id: "r1", sort: 0, name: "Flur", etage: "", materialText: "", bemerkung: "" }],
  positionen: [{
    id: "x1", raumId: "r1", sort: 0, nr: "1", menge: "", einheit: "", artikel: "", titel: "Schrank", langtext: "",
    relevant: true, vorlageId: null, status: "offen", bemerkung: "", pruefpunkte: [],
  }],
});

test("Anzeige ohne Kommission", () => {
  assert.equal(kommissionAnzeige("", "de"), "ohne Kommission");
  assert.equal(kommissionAnzeige(null, "en"), "no commission");
  assert.equal(kommissionAnzeige(" 260081 "), "260081");
  assert.equal(hatKommission({ kommissionNr: "  " }), false);
});

test("Auswahl: bestehend braucht Treffer, neu braucht 6 Ziffern, ohne nur Kunde", () => {
  const k = { modus: "bestehend" as const, commissionId: null, nr: "", kunde: "Hoon", projekt: "" };
  assert.equal(validiereKundeKommission(k).length, 1);
  assert.deepEqual(validiereKundeKommission({ ...k, commissionId: "c1", nr: "260081" }), []);
  assert.match(validiereKundeKommission({ ...k, modus: "neu", nr: "12" })[0], /6 Ziffern/);
  assert.deepEqual(validiereKundeKommission({ ...k, modus: "neu", nr: "260099" }), []);
  assert.deepEqual(validiereKundeKommission({ ...k, modus: "ohne" }), []);
  assert.deepEqual(validiereKundeKommission({ ...k, modus: "ohne", kunde: " " }), ["Kundenname fehlt."]);
});

test("wendeAuswahlAn: ohne Kommission leert Nummer und commissionId", () => {
  const d = wendeAuswahlAn({ ...basis(), commissionId: "c1", kommissionNr: "260081" }, { modus: "ohne", commissionId: "c1", nr: "260081", kunde: " Meier ", projekt: "" });
  assert.equal(d.kommissionNr, "");
  assert.equal(d.commissionId, null);
  assert.equal(d.kunde, "Meier");
  const n = wendeAuswahlAn(basis(), { modus: "neu", commissionId: "alt", nr: "260099", kunde: "A", projekt: "P" });
  assert.equal(n.commissionId, null);
  assert.equal(n.kommissionNr, "260099");
});

test("auswahlAusDoc", () => {
  assert.equal(auswahlAusDoc({ commissionId: null, kommissionNr: "", kunde: "A", projekt: "" }).modus, "ohne");
  assert.equal(auswahlAusDoc({ commissionId: null, kommissionNr: "260099", kunde: "A", projekt: "" }).modus, "neu");
  assert.equal(auswahlAusDoc({ commissionId: "c", kommissionNr: "260099", kunde: "A", projekt: "" }).modus, "bestehend");
});

test("Validierung neues Protokoll", () => {
  const kk = { modus: "ohne" as const, commissionId: null, nr: "", kunde: "Meier", projekt: "" };
  assert.ok(validiereNeuesProtokoll(basis(), kk).some((p) => /Raum/.test(p)));
  assert.ok(validiereNeuesProtokoll(basis(), kk).some((p) => /Position/.test(p)));
  assert.deepEqual(validiereNeuesProtokoll(mitPosition(), kk), []);
  const ohneKunde = validiereNeuesProtokoll(mitPosition(), { ...kk, kunde: "" });
  assert.deepEqual(ohneKunde, ["Kundenname fehlt."]);
  const d = mitPosition();
  d.positionen[0].titel = " ";
  assert.ok(validiereNeuesProtokoll(d, kk).some((p) => /Titel/.test(p)));
  const e = mitPosition();
  e.positionen[0].raumId = null;
  assert.ok(validiereNeuesProtokoll(e, kk).some((p) => /Raum/.test(p)));
});

test("Mapping: quelle und leere Kommission", () => {
  const doc = { ...mitPosition(), kunde: "Meier", quelle: "vorlage" as const };
  const rows = docToRows(doc);
  assert.equal(rows.protokoll.quelle, "vorlage");
  assert.equal(rows.protokoll.kommission_nr, null);
  const zurueck = rowsToDoc({ protokoll: { ...rows.protokoll }, raeume: rows.raeume, positionen: rows.positionen, pruefpunkte: [], maengel: [], fotos: [], unterschriften: [] });
  assert.equal(zurueck.quelle, "vorlage");
  assert.equal(zurueck.kommissionNr, "");
  assert.equal(zuQuelle(undefined), "profacto");
  assert.equal(zuQuelle("manuell"), "manuell");
  // Altbestand ohne quelle im Dokument
  const alt = { ...doc } as Partial<ProtokollDoc>;
  delete alt.quelle;
  assert.equal(docToRows(alt as ProtokollDoc).protokoll.quelle, "profacto");
});
