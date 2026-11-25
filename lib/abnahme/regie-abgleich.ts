import { nummeriere } from "./regie-logic.ts";
import type { Aenderung, Wahlen, Seite } from "./abgleich.ts";
import { standardWahl } from "./abgleich.ts";
import type { RegieDoc, RegieZeile } from "./types.ts";

/**
 * Abgleich zweier Stände eines Regieberichts (Tablet = „lokal“, Datenbank = „server“), wie bei den Protokollen
 * (abgleich.ts): Unterschiede werden je Eintrag (Kopffeld, Arbeitszeile, Kundenunterschrift) aufgelistet, der Nutzer
 * wählt je Eintrag eine Seite, `fuehreRegieZusammen` baut das Ergebnis. Ohne Basis gilt jeder Unterschied als Konflikt.
 */

type Eintrag = { gruppe: Aenderung["gruppe"]; titel: string; norm: string; anzeige: string };
const j = (x: unknown) => JSON.stringify(x);

const KOPF: { id: string; titel: string; wert: (d: RegieDoc) => unknown; anzeige: (d: RegieDoc) => string }[] = [
  { id: "kommission", titel: "Kommission", wert: (d) => [d.commissionId, d.kommissionNr.trim()], anzeige: (d) => d.kommissionNr || "—" },
  { id: "kunde", titel: "Kunde", wert: (d) => d.kunde.trim(), anzeige: (d) => d.kunde || "—" },
  { id: "name", titel: "Auftraggeber", wert: (d) => d.name.trim(), anzeige: (d) => d.name || "—" },
  { id: "strasse", titel: "Straße", wert: (d) => d.strasse.trim(), anzeige: (d) => d.strasse || "—" },
  { id: "ort", titel: "Ort", wert: (d) => d.ort.trim(), anzeige: (d) => d.ort || "—" },
  { id: "telefon", titel: "Telefon", wert: (d) => d.telefon.trim(), anzeige: (d) => d.telefon || "—" },
  { id: "datum", titel: "Datum", wert: (d) => d.datum, anzeige: (d) => d.datum || "—" },
  { id: "beschreibung", titel: "Auftrag", wert: (d) => d.beschreibung.trim(), anzeige: (d) => d.beschreibung || "—" },
  { id: "sprache", titel: "Sprache", wert: (d) => d.sprache, anzeige: (d) => (d.sprache === "en" ? "English" : "Deutsch") },
  { id: "kundeEmail", titel: "Kunden-E-Mail", wert: (d) => d.kundeEmail.trim(), anzeige: (d) => d.kundeEmail || "—" },
  { id: "kopieEmail", titel: "Kopie-E-Mail", wert: (d) => d.kopieEmail.trim(), anzeige: (d) => d.kopieEmail || "—" },
  { id: "mitarbeiter", titel: "Mitarbeiter", wert: (d) => [d.mitarbeiterId, d.mitarbeiterName.trim()], anzeige: (d) => d.mitarbeiterName || "—" },
];

function zeileEintrag(z: RegieZeile): Eintrag {
  const std = [z.stdMeister && `M ${z.stdMeister}`, z.stdMonteur && `Mo ${z.stdMonteur}`, z.stdLehrling && `L ${z.stdLehrling}`, z.stdHelfer && `H ${z.stdHelfer}`].filter(Boolean).join(" ");
  return {
    gruppe: "Arbeitszeile", titel: `Zeile: ${(z.text || "ohne Text").slice(0, 50)}`,
    norm: j([z.datum, z.text, z.menge, z.laenge, z.breite, z.staerke, z.km, z.stdMeister, z.stdMonteur, z.stdLehrling, z.stdHelfer]),
    anzeige: [z.datum, z.text, z.menge && `Menge ${z.menge}`, std && `Std ${std}`, z.km != null && `${z.km} km`].filter(Boolean).join(" · "),
  };
}

function katalog(d: RegieDoc): Map<string, Eintrag> {
  const m = new Map<string, Eintrag>();
  for (const k of KOPF) m.set(`kopf:${k.id}`, { gruppe: "Kopf", titel: k.titel, norm: j(k.wert(d)), anzeige: k.anzeige(d) });
  for (const z of d.zeilen) m.set(`zeile:${z.id}`, zeileEintrag(z));
  if (d.unterschriftName.trim() || d.anerkanntAt) {
    m.set("sig", { gruppe: "Unterschrift", titel: "Kundenunterschrift", norm: j([d.unterschriftName.trim(), d.anerkanntAt]), anzeige: d.unterschriftName || "vorhanden" });
  }
  return m;
}

export function berechneRegieAenderungen(basis: RegieDoc | null | undefined, lokal: RegieDoc, server: RegieDoc): Aenderung[] {
  const L = katalog(lokal);
  const S = katalog(server);
  const B = basis ? katalog(basis) : null;
  const out: Aenderung[] = [];
  for (const key of new Set([...L.keys(), ...S.keys()])) {
    const l = L.get(key);
    const s = S.get(key);
    if (l && s && l.norm === s.norm) continue;
    const b = B?.get(key);
    const lokalGeaendert = !B ? true : (l?.norm ?? null) !== (b?.norm ?? null);
    const serverGeaendert = !B ? true : (s?.norm ?? null) !== (b?.norm ?? null);
    const von: Aenderung["von"] = lokalGeaendert && serverGeaendert ? "beide" : lokalGeaendert ? "lokal" : "server";
    const ref = l ?? s!;
    out.push({ key, gruppe: ref.gruppe, titel: ref.titel, von, lokal: l ? l.anzeige : null, server: s ? s.anzeige : null });
  }
  const reihenfolge: Record<string, number> = { Kopf: 0, Arbeitszeile: 1, Unterschrift: 2 };
  return out.sort((a, b) => (reihenfolge[a.gruppe] ?? 9) - (reihenfolge[b.gruppe] ?? 9));
}

export function fuehreRegieZusammen(basis: RegieDoc | null | undefined, lokal: RegieDoc, server: RegieDoc, wahlen: Wahlen): RegieDoc {
  const liste = berechneRegieAenderungen(basis, lokal, server);
  const wahl = (key: string): Seite => wahlen[key] ?? (() => {
    const a = liste.find((x) => x.key === key);
    return a ? standardWahl(a) : "server";
  })();
  const betroffen = new Set(liste.map((a) => a.key));
  const quelle = (key: string): RegieDoc => (betroffen.has(key) ? (wahl(key) === "lokal" ? lokal : server) : server);
  const k = (id: string) => quelle(`kopf:${id}`);

  const ids = new Set([...lokal.zeilen.map((z) => z.id), ...server.zeilen.map((z) => z.id)]);
  const zeilen: RegieZeile[] = [];
  for (const id of ids) {
    const z = quelle(`zeile:${id}`).zeilen.find((x) => x.id === id);
    if (z) zeilen.push(z);
  }
  zeilen.sort((a, b) => a.pos - b.pos);

  const sigQuelle = quelle("sig");
  const sigAndere = sigQuelle === lokal ? server : lokal;
  return {
    ...server,
    commissionId: k("kommission").commissionId, kommissionNr: k("kommission").kommissionNr, kunde: k("kunde").kunde, name: k("name").name,
    strasse: k("strasse").strasse, ort: k("ort").ort, telefon: k("telefon").telefon, datum: k("datum").datum,
    beschreibung: k("beschreibung").beschreibung, sprache: k("sprache").sprache, kundeEmail: k("kundeEmail").kundeEmail,
    kopieEmail: k("kopieEmail").kopieEmail, mitarbeiterId: k("mitarbeiter").mitarbeiterId, mitarbeiterName: k("mitarbeiter").mitarbeiterName,
    unterschriftName: sigQuelle.unterschriftName, anerkanntAt: sigQuelle.anerkanntAt,
    unterschriftPath: sigQuelle.unterschriftPath ?? sigAndere.unterschriftPath,
    // Abschluss und das lokal erzeugte PDF gehören zum Tablet-Stand.
    status: lokal.status, pdfPath: lokal.pdfPath ?? server.pdfPath,
    rev: server.rev,
    zeilen: nummeriere(zeilen),
  };
}
