import { test } from "node:test";
import assert from "node:assert/strict";
import { ostersonntag, feiertageBW } from "./feiertage.ts";
import { berechneTage, tageProTag, musterFuerTag } from "./tage.ts";
import { berechneKonto, uebertragVorschlag, restNachEntscheidung } from "./konto.ts";
import { istISO, zeitraumText, tageText } from "./datum.ts";
import { findeKonflikte, sortiertesPaar } from "./konflikte.ts";
import { addDays, eachDay, wochentag } from "./datum.ts";
import type { Antrag, ArbeitsmusterEintrag, Betriebsferien } from "./types.ts";

test("Ostersonntag bekannter Jahre", () => {
  assert.equal(ostersonntag(2024), "2024-03-31");
  assert.equal(ostersonntag(2025), "2025-04-20");
  assert.equal(ostersonntag(2026), "2026-04-05");
  assert.equal(ostersonntag(2027), "2027-03-28");
  assert.equal(ostersonntag(2038), "2038-04-25");
});

test("Feiertage BW 2026", () => {
  const f = feiertageBW(2026);
  assert.equal(f.size, 12);
  assert.equal(f.get("2026-04-03"), "Karfreitag");
  assert.equal(f.get("2026-04-06"), "Ostermontag");
  assert.equal(f.get("2026-05-14"), "Christi Himmelfahrt");
  assert.equal(f.get("2026-05-25"), "Pfingstmontag");
  assert.equal(f.get("2026-06-04"), "Fronleichnam");
  assert.ok(f.has("2026-01-06") && f.has("2026-11-01") && f.has("2026-12-26"));
  assert.ok(!f.has("2026-12-24")); // kein Feiertag, nur halber Tag
});

test("Datum-Helfer", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(wochentag("2026-11-16"), 0); // Montag
  assert.deepEqual(eachDay("2026-01-30", "2026-02-02").length, 4);
  assert.deepEqual(eachDay("2026-02-02", "2026-02-01"), []);
});

test("Woche Mo–Fr = 5 Tage, Wochenende zählt nicht", () => {
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-22" }), 5);
  assert.equal(berechneTage({ von: "2026-11-21", bis: "2026-11-22" }), 0);
});

test("Feiertage zählen nicht (Ostern 2026: Fr 3.4. und Mo 6.4.)", () => {
  assert.equal(berechneTage({ von: "2026-03-30", bis: "2026-04-10" }), 8);
});

test("Halbe Tage: Anfang, Ende, beide, eintägig", () => {
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-18", halbtagStart: true }), 2.5);
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-18", halbtagEnde: true }), 2.5);
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-18", halbtagStart: true, halbtagEnde: true }), 2);
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-16", halbtagStart: true }), 0.5);
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-16", halbtagStart: true, halbtagEnde: true }), 0.5);
});

test("Halber Tag auf einem Nicht-Arbeitstag ändert nichts", () => {
  // Sa–Mo, Halbtag am Start (Samstag) → Montag zählt voll
  assert.equal(berechneTage({ von: "2026-11-21", bis: "2026-11-23", halbtagStart: true }), 1);
});

test("24.12. und 31.12. zählen nur halb, auch mit Halbtag-Flag", () => {
  assert.equal(berechneTage({ von: "2026-12-24", bis: "2026-12-24" }), 0.5); // Donnerstag
  assert.equal(berechneTage({ von: "2026-12-24", bis: "2026-12-24", halbtagStart: true }), 0.5);
  assert.equal(berechneTage({ von: "2026-12-31", bis: "2026-12-31" }), 0.5); // Donnerstag
  // 21.–31.12.2026: Mo21 Di22 Mi23 =3, Do24 =0,5, Fr25/Sa26 Feiertag bzw. WE, Mo28 Di29 Mi30 =3, Do31 =0,5
  assert.equal(berechneTage({ von: "2026-12-21", bis: "2026-12-31" }), 7);
});

test("24.12. am Wochenende zählt nicht (2022: Samstag)", () => {
  assert.equal(berechneTage({ von: "2022-12-24", bis: "2022-12-24" }), 0);
});

test("Arbeitsmuster: Teilzeit Mo/Di/Mi, Muster mit Gültigkeitsdatum", () => {
  const teil: ArbeitsmusterEintrag = { gueltig_ab: "2026-01-01", mo: true, di: true, mi: true, do: false, fr: false, sa: false, so: false };
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-22", muster: [teil] }), 3);
  const neu: ArbeitsmusterEintrag = { ...teil, gueltig_ab: "2026-11-18", do: true, fr: true };
  const muster = [teil, neu];
  assert.equal(musterFuerTag(muster, "2026-11-17").do, false);
  assert.equal(musterFuerTag(muster, "2026-11-18").do, true);
  assert.equal(musterFuerTag([], "2026-11-18").fr, true); // Standard Mo–Fr
  // 16.–22.11.: Mo, Di alt (2) + Mi, Do, Fr neu (3) = 5
  assert.equal(berechneTage({ von: "2026-11-16", bis: "2026-11-22", muster }), 5);
});

test("Betriebsferien ohne Abzug zählen nicht, mit Abzug zählen im Antrag mit", () => {
  const frei: Betriebsferien = { id: "b", von: "2026-08-03", bis: "2026-08-07", titel: "Sommer", zaehlt_als_urlaub: false };
  const abzug: Betriebsferien = { ...frei, zaehlt_als_urlaub: true };
  assert.equal(berechneTage({ von: "2026-08-03", bis: "2026-08-14", betriebsferien: [frei] }), 5);
  assert.equal(berechneTage({ von: "2026-08-03", bis: "2026-08-14", betriebsferien: [abzug] }), 10);
  const t = tageProTag({ von: "2026-08-03", bis: "2026-08-03", betriebsferien: [frei] });
  assert.equal(t[0].grund, "betriebsferien");
});

test("bis < von ergibt 0", () => {
  assert.equal(berechneTage({ von: "2026-11-18", bis: "2026-11-16" }), 0);
});

const kont = { anspruch: 30, uebertrag: 0, uebertrag_verfall: "2026-03-31", korrektur: 0 };
const antrag = (over: Partial<Antrag>): Pick<Antrag, "art" | "von" | "bis" | "halbtag_start" | "halbtag_ende" | "status"> => ({
  art: "urlaub", von: "2026-11-16", bis: "2026-11-20", halbtag_start: false, halbtag_ende: false, status: "genehmigt", ...over,
});
const basis = { jahr: 2026, kontingent: kont, muster: [], betriebsferien: [], heute: "2026-11-18" };

test("Konto: genommen / geplant / beantragt / Rest", () => {
  const k = berechneKonto({
    ...basis,
    antraege: [
      antrag({ von: "2026-07-06", bis: "2026-07-10" }), // genommen 5
      antrag({ von: "2026-12-07", bis: "2026-12-11" }), // geplant 5
      antrag({ von: "2026-12-14", bis: "2026-12-16", status: "beantragt" }), // beantragt 3
      antrag({ von: "2026-02-02", bis: "2026-02-06", status: "abgelehnt" }),
      antrag({ von: "2026-02-09", bis: "2026-02-13", status: "zurueckgezogen" }),
      antrag({ von: "2026-03-02", bis: "2026-03-06", art: "ueberstunden" }), // zählt nicht
      antrag({ von: "2026-03-09", bis: "2026-03-13", art: "sonder" }),
    ],
  });
  assert.equal(k.genommen, 5);
  assert.equal(k.geplant, 5);
  assert.equal(k.beantragt, 3);
  assert.equal(k.rest, 20);
  assert.equal(k.restNachBeantragt, 17);
});

test("Konto: Storno beantragt zählt weiter als genehmigt, storniert nicht", () => {
  const k = berechneKonto({
    ...basis,
    antraege: [antrag({ status: "storno_beantragt" }), antrag({ von: "2026-12-07", bis: "2026-12-11", status: "storniert" })],
  });
  assert.equal(k.genommen + k.geplant, 5);
});

test("Konto: Betriebsferien mit Abzug werden automatisch abgezogen, ohne Doppelzählung", () => {
  const bf: Betriebsferien = { id: "b", von: "2026-08-03", bis: "2026-08-07", titel: "Sommer", zaehlt_als_urlaub: true };
  const ohne = berechneKonto({ ...basis, betriebsferien: [bf], antraege: [] });
  assert.equal(ohne.genommen, 5);
  const doppelt = berechneKonto({ ...basis, betriebsferien: [bf], antraege: [antrag({ von: "2026-08-03", bis: "2026-08-14" })] });
  assert.equal(doppelt.genommen, 10); // 5 Betriebsferien + 5 eigene Tage danach, nicht 15
  const frei = berechneKonto({ ...basis, betriebsferien: [{ ...bf, zaehlt_als_urlaub: false }], antraege: [] });
  assert.equal(frei.genommen, 0);
});

test("Konto: Betriebsferien-Abzug folgt dem Arbeitsmuster", () => {
  const bf: Betriebsferien = { id: "b", von: "2026-08-03", bis: "2026-08-07", titel: "Sommer", zaehlt_als_urlaub: true };
  const teil: ArbeitsmusterEintrag = { gueltig_ab: "2026-01-01", mo: true, di: true, mi: true, do: false, fr: false, sa: false, so: false };
  assert.equal(berechneKonto({ ...basis, betriebsferien: [bf], muster: [teil], antraege: [] }).genommen, 3);
});

test("Konto: Antrag über den Jahreswechsel zählt je Jahr", () => {
  const a = antrag({ von: "2026-12-28", bis: "2027-01-08" });
  const k26 = berechneKonto({ ...basis, antraege: [a] });
  const k27 = berechneKonto({ ...basis, jahr: 2027, heute: "2026-11-18", antraege: [a] });
  // 28., 29., 30. = 3, 31. = 0,5
  assert.equal(k26.geplant, 3.5);
  // 2027: 1.1. Feiertag (Fr), 4.–8.1. (6.1. Feiertag) = 4
  assert.equal(k27.geplant, 4);
});

test("Konto: Übertrag wird zuerst verbraucht, Rest verfällt nach dem Stichtag", () => {
  const mitUebertrag = { ...kont, uebertrag: 5 };
  const heute = "2026-11-18";
  // 2 Tage im Februar genommen → 3 Tage Übertrag verfallen
  const k = berechneKonto({
    ...basis, heute, kontingent: mitUebertrag,
    antraege: [antrag({ von: "2026-02-02", bis: "2026-02-03" })],
  });
  assert.equal(k.uebertragGenutzt, 2);
  assert.equal(k.uebertragVerfallen, 3);
  assert.equal(k.rest, 30 + 5 - 3 - 2); // 30
  // Vor dem Stichtag ist noch nichts verfallen
  const frueh = berechneKonto({ ...basis, heute: "2026-03-01", kontingent: mitUebertrag, antraege: [] });
  assert.equal(frueh.uebertragVerfallen, 0);
  assert.equal(frueh.rest, 35);
  // Mehr Urlaub vor dem Stichtag als Übertrag → nichts verfällt
  const voll = berechneKonto({
    ...basis, heute, kontingent: mitUebertrag,
    antraege: [antrag({ von: "2026-02-02", bis: "2026-02-13" })], // 10 Tage
  });
  assert.equal(voll.uebertragVerfallen, 0);
  assert.equal(voll.rest, 25);
});

test("Konto: Korrektur und fehlendes Kontingent", () => {
  const k = berechneKonto({ ...basis, kontingent: { ...kont, korrektur: -2 }, antraege: [] });
  assert.equal(k.rest, 28);
  const leer = berechneKonto({ ...basis, kontingent: null, antraege: [] });
  assert.equal(leer.rest, 0);
});

test("Übertrag-Vorschlag: Rest des Vorjahres, nie negativ", () => {
  const v = uebertragVorschlag({
    jahr: 2026, kontingent: kont, muster: [], betriebsferien: [],
    antraege: [antrag({ von: "2026-07-06", bis: "2026-07-17" })], // 10 Tage
  });
  assert.equal(v, 20);
  const minus = uebertragVorschlag({
    jahr: 2026, kontingent: { ...kont, anspruch: 2 }, muster: [], betriebsferien: [],
    antraege: [antrag({ von: "2026-07-06", bis: "2026-07-10" })],
  });
  assert.equal(minus, 0);
});

test("Konflikte: Paare und Sperren, nur aktive Anträge", () => {
  const a = { id: "1", employee_id: "nic", von: "2026-12-07", bis: "2026-12-11" };
  const alle = [
    { id: "2", employee_id: "noah", von: "2026-12-10", bis: "2026-12-18", status: "beantragt" as const },
    { id: "3", employee_id: "noah", von: "2026-12-01", bis: "2026-12-30", status: "abgelehnt" as const },
    { id: "4", employee_id: "andere", von: "2026-12-07", bis: "2026-12-11", status: "genehmigt" as const },
  ];
  const paare = [{ id: "p", employee_a: "nic", employee_b: "noah" }];
  const sperren = [{ id: "s", von: "2026-12-11", bis: "2026-12-12", titel: "Messe" }];
  const k = findeKonflikte(a, alle, paare, sperren);
  assert.deepEqual(k.paare, [{ partnerId: "noah", antragId: "2" }]);
  assert.equal(k.sperren[0].titel, "Messe");
  assert.deepEqual(findeKonflikte({ ...a, bis: "2026-12-09" }, alle, paare, sperren), { paare: [], sperren: [] });
  assert.deepEqual(sortiertesPaar("b", "a"), ["a", "b"]);
});

test("Rest nach Entscheidung im Eingang", () => {
  const antraege = [
    { ...antrag({ von: "2026-07-06", bis: "2026-07-10" }), id: "a" }, // genehmigt, 5
    { ...antrag({ von: "2026-12-07", bis: "2026-12-11", status: "beantragt" }), id: "b" },
    { ...antrag({ von: "2026-12-14", bis: "2026-12-16", status: "beantragt" }), id: "c" },
  ];
  assert.equal(restNachEntscheidung({ ...basis, antraege }, "b", "genehmigt"), 20); // 30 − 5 − 5
  const mitStorno = [{ ...antrag({ von: "2026-07-06", bis: "2026-07-10", status: "storno_beantragt" }), id: "a" }];
  assert.equal(restNachEntscheidung({ ...basis, antraege: mitStorno }, "a", "storniert"), 30);
});

test("Datum-Validierung und Text", () => {
  assert.equal(istISO("2026-02-29"), false);
  assert.equal(istISO("2028-02-29"), true);
  assert.equal(istISO("2026-2-1"), false);
  assert.equal(zeitraumText("2026-08-10", "2026-08-14"), "10.08.–14.08.2026");
  assert.equal(zeitraumText("2026-12-28", "2027-01-08"), "28.12.2026–08.01.2027");
  assert.equal(zeitraumText("2026-08-10", "2026-08-10"), "10.08.2026");
  assert.equal(tageText(2.5), "2,5");
  assert.equal(tageText(3), "3");
});
