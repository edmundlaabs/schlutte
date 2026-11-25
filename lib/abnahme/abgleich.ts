import { positionStatus } from "./logic.ts";
import type { Foto, Mangel, Position, ProtokollDoc, PruefStatus, Pruefpunkt, Raum, Unterschrift } from "./types.ts";

/**
 * Abgleich zweier Stände desselben Protokolls (Tablet = „lokal“, Datenbank = „server“), wenn beide seit dem letzten
 * gemeinsamen Stand („basis“) verändert wurden. Es gibt kein Auschecken mehr: mehrere Geräte dürfen parallel arbeiten.
 *
 * Ablauf: `berechneAenderungen` listet jeden Unterschied (Kopf, Räume, Positionen, Prüfpunkte, Mängel, Fotos,
 * Unterschriften) und sagt, wer ihn gemacht hat. Der Nutzer wählt je Eintrag „Tablet“ oder „Server“ – daraus wird
 * hinzugefügt (zusammenfügen), ersetzt oder gelöscht. `fuehreZusammen` baut daraus das neue Protokoll.
 * Fehlt die Basis (älteres Tablet-Dokument), gelten alle Unterschiede als Konflikt.
 */

export type Seite = "lokal" | "server";
export type Gruppe = "Kopf" | "Raum" | "Position" | "Prüfpunkt" | "Mangel" | "Foto" | "Unterschrift" | "Arbeitszeile";

export type Aenderung = {
  /** Stabiler Schlüssel (z. B. „pos:<id>“, „kopf:ort“). */
  key: string;
  gruppe: Gruppe;
  /** Lesbare Bezeichnung des betroffenen Eintrags. */
  titel: string;
  /** Wer hat gegenüber der Basis geändert? „beide“ = Konflikt. */
  von: Seite | "beide";
  /** Anzeige des Werts auf der jeweiligen Seite; null = nicht vorhanden. */
  lokal: string | null;
  server: string | null;
};

export type Wahlen = Record<string, Seite>;

/** Vorauswahl: die Änderung der Seite, die geändert hat; bei Konflikt der Tablet-Stand. */
export function standardWahl(a: Aenderung): Seite {
  return a.von === "server" ? "server" : "lokal";
}

/** Was passiert, wenn für diesen Eintrag die Seite gewählt wird? */
export function aktion(a: Aenderung, wahl: Seite): "hinzufuegen" | "ersetzen" | "loeschen" {
  const gewaehlt = wahl === "lokal" ? a.lokal : a.server;
  const andere = wahl === "lokal" ? a.server : a.lokal;
  if (gewaehlt === null) return "loeschen";
  return andere === null ? "hinzufuegen" : "ersetzen";
}

// ─── Eintragskatalog je Stand ────────────────────────────────────────────────

type Eintrag = { gruppe: Gruppe; titel: string; norm: string; anzeige: string };

const STATUS: Record<PruefStatus, string> = { offen: "offen", io: "i. O.", mangel: "Mangel", nicht_pruefbar: "nicht prüfbar" };
const j = (x: unknown) => JSON.stringify(x);

const KOPF: { id: string; titel: string; wert: (d: ProtokollDoc) => unknown; anzeige: (d: ProtokollDoc) => string }[] = [
  { id: "kunde", titel: "Kunde", wert: (d) => d.kunde.trim(), anzeige: (d) => d.kunde || "—" },
  { id: "projekt", titel: "Projekt", wert: (d) => d.projekt.trim(), anzeige: (d) => d.projekt || "—" },
  { id: "titel", titel: "Bezeichnung", wert: (d) => d.titel.trim(), anzeige: (d) => d.titel || "—" },
  { id: "ort", titel: "Ort", wert: (d) => d.ort.trim(), anzeige: (d) => d.ort || "—" },
  { id: "sprache", titel: "Sprache", wert: (d) => d.sprache, anzeige: (d) => (d.sprache === "en" ? "English" : "Deutsch") },
  { id: "kundeEmail", titel: "Kunden-E-Mail", wert: (d) => d.kundeEmail.trim(), anzeige: (d) => d.kundeEmail || "—" },
  { id: "kopieEmail", titel: "Kopie-E-Mail", wert: (d) => d.kopieEmail.trim(), anzeige: (d) => d.kopieEmail || "—" },
  { id: "bemerkung", titel: "Bemerkung", wert: (d) => d.bemerkung.trim(), anzeige: (d) => d.bemerkung || "—" },
  { id: "beginnAt", titel: "Beginn", wert: (d) => d.beginnAt, anzeige: (d) => d.beginnAt ?? "—" },
  { id: "mitarbeiter", titel: "Durchführender Mitarbeiter", wert: (d) => [d.mitarbeiterId, d.mitarbeiterName.trim()], anzeige: (d) => d.mitarbeiterName || "—" },
  { id: "kommission", titel: "Kommission", wert: (d) => [d.commissionId, d.kommissionNr.trim()], anzeige: (d) => d.kommissionNr || "ohne Kommission" },
  {
    id: "teilnehmer", titel: "Teilnehmer",
    wert: (d) => d.teilnehmer.map((t) => [t.name, t.rolle ?? ""]).sort(),
    anzeige: (d) => d.teilnehmer.map((t) => t.name).join(", ") || "—",
  },
];

function raumEintrag(r: Raum): Eintrag {
  return {
    gruppe: "Raum", titel: `Raum „${r.name}“`,
    norm: j([r.name, r.etage, r.materialText, r.bemerkung]),
    anzeige: [r.etage, r.name].filter(Boolean).join(" · "),
  };
}

function posEintrag(p: Position, raeume: Raum[]): Eintrag {
  const raum = raeume.find((r) => r.id === p.raumId)?.name ?? "ohne Raum";
  // Der Status einer Position mit Prüfpunkten ergibt sich aus diesen und ist dort aufgelistet.
  const status = p.pruefpunkte.length === 0 ? p.status : null;
  return {
    gruppe: "Position", titel: `Position ${p.nr} ${p.titel}`.trim(),
    norm: j([p.nr, p.titel, p.menge, p.einheit, p.artikel, p.langtext, p.relevant, p.vorlageId, p.raumId, p.bemerkung, status]),
    anzeige: [raum, p.menge && `${p.menge} ${p.einheit}`.trim(), status ? STATUS[status] : null, p.relevant ? null : "ausgeblendet", p.bemerkung].filter(Boolean).join(" · "),
  };
}

function ppEintrag(k: Pruefpunkt, p: Position): Eintrag {
  return {
    gruppe: "Prüfpunkt", titel: `Prüfpunkt „${k.textDe}“ (Position ${p.nr})`,
    norm: j([k.textDe, k.textEn, k.status, k.bemerkung]),
    anzeige: [STATUS[k.status], k.bemerkung].filter(Boolean).join(" · "),
  };
}

function mangelEintrag(m: Mangel, d: ProtokollDoc): Eintrag {
  const pos = d.positionen.find((p) => p.id === m.positionId);
  return {
    gruppe: "Mangel", titel: `Mangel${pos ? ` an Position ${pos.nr}` : ""}: ${m.text.slice(0, 60)}`,
    norm: j([m.text, m.frist, m.erledigtAt, m.raumId, m.positionId, m.pruefpunktId]),
    anzeige: [m.text, m.frist && `Frist ${m.frist}`, m.erledigtAt ? "erledigt" : null].filter(Boolean).join(" · "),
  };
}

function fotoEintrag(f: Foto, d: ProtokollDoc): Eintrag {
  const m = d.maengel.find((x) => x.id === f.mangelId);
  return { gruppe: "Foto", titel: `Foto zu Mangel „${(m?.text ?? "").slice(0, 40)}“`, norm: j([f.mangelId]), anzeige: "vorhanden" };
}

function sigEintrag(u: Unterschrift): Eintrag {
  return {
    gruppe: "Unterschrift", titel: `Unterschrift ${u.name} (${u.bezug.replace("_", " ")})`,
    norm: j([u.bezug, u.bezugId, u.name, u.rolle, u.zeitpunkt]),
    anzeige: `${u.name}${u.rolle ? `, ${u.rolle}` : ""}`,
  };
}

function katalog(d: ProtokollDoc): Map<string, Eintrag> {
  const m = new Map<string, Eintrag>();
  for (const k of KOPF) {
    m.set(`kopf:${k.id}`, { gruppe: "Kopf", titel: k.titel, norm: j(k.wert(d)), anzeige: k.anzeige(d) });
  }
  for (const r of d.raeume) m.set(`raum:${r.id}`, raumEintrag(r));
  for (const p of d.positionen) {
    m.set(`pos:${p.id}`, posEintrag(p, d.raeume));
    for (const k of p.pruefpunkte) m.set(`pp:${p.id}:${k.id}`, ppEintrag(k, p));
  }
  for (const x of d.maengel) m.set(`mangel:${x.id}`, mangelEintrag(x, d));
  for (const f of d.fotos) m.set(`foto:${f.id}`, fotoEintrag(f, d));
  for (const u of d.unterschriften) m.set(`sig:${u.id}`, sigEintrag(u));
  return m;
}

/**
 * Alle Unterschiede zwischen Tablet- und Server-Stand. Prüfpunkte einer Position, die nur auf einer Seite existiert,
 * werden nicht einzeln aufgelistet (sie gehören zur Position).
 */
export function berechneAenderungen(basis: ProtokollDoc | null | undefined, lokal: ProtokollDoc, server: ProtokollDoc): Aenderung[] {
  const L = katalog(lokal);
  const S = katalog(server);
  const B = basis ? katalog(basis) : null;
  const lokalPos = new Set(lokal.positionen.map((p) => p.id));
  const serverPos = new Set(server.positionen.map((p) => p.id));

  const keys = new Set([...L.keys(), ...S.keys()]);
  const out: Aenderung[] = [];
  for (const key of keys) {
    const l = L.get(key);
    const s = S.get(key);
    if (l && s && l.norm === s.norm) continue;
    if (key.startsWith("pp:")) {
      const posId = key.split(":")[1];
      if (!(lokalPos.has(posId) && serverPos.has(posId))) continue;
    }
    const b = B?.get(key);
    const lokalGeaendert = !B ? true : (l?.norm ?? null) !== (b?.norm ?? null);
    const serverGeaendert = !B ? true : (s?.norm ?? null) !== (b?.norm ?? null);
    const von: Aenderung["von"] = lokalGeaendert && serverGeaendert ? "beide" : lokalGeaendert ? "lokal" : "server";
    const ref = l ?? s!;
    out.push({ key, gruppe: ref.gruppe, titel: ref.titel, von, lokal: l ? l.anzeige : null, server: s ? s.anzeige : null });
  }
  const reihenfolge: Record<Gruppe, number> = { Kopf: 0, Raum: 1, Position: 2, "Prüfpunkt": 3, Mangel: 4, Foto: 5, Unterschrift: 6, Arbeitszeile: 7 };
  return out.sort((a, b) => reihenfolge[a.gruppe] - reihenfolge[b.gruppe]);
}

// ─── Zusammenführen ──────────────────────────────────────────────────────────

const nummeriert = <T extends { sort: number }>(liste: T[]): T[] =>
  [...liste].sort((a, b) => a.sort - b.sort).map((x, i) => ({ ...x, sort: i }));

/**
 * Baut aus beiden Ständen das neue Protokoll. Ausgangspunkt ist der Server-Stand; für jeden aufgelisteten Eintrag
 * entscheidet `wahlen` (fehlt ein Schlüssel: die Vorauswahl). Eintrag auf der gewählten Seite nicht vorhanden = gelöscht.
 * Bezüge (Mängel zu Positionen, Fotos zu Mängeln, Unterschriften zu Räumen/Positionen) werden bereinigt.
 */
export function fuehreZusammen(basis: ProtokollDoc | null | undefined, lokal: ProtokollDoc, server: ProtokollDoc, wahlen: Wahlen): ProtokollDoc {
  const liste = berechneAenderungen(basis, lokal, server);
  const wahl = (key: string): Seite => wahlen[key] ?? (() => {
    const a = liste.find((x) => x.key === key);
    return a ? standardWahl(a) : "server";
  })();
  const betroffen = new Set(liste.map((a) => a.key));
  const quelle = (key: string): ProtokollDoc => (betroffen.has(key) ? (wahl(key) === "lokal" ? lokal : server) : server);

  // Kopf
  let doc: ProtokollDoc = { ...server };
  const kopfVon = (id: string): ProtokollDoc => quelle(`kopf:${id}`);
  doc = {
    ...doc,
    kunde: kopfVon("kunde").kunde, projekt: kopfVon("projekt").projekt, titel: kopfVon("titel").titel, ort: kopfVon("ort").ort,
    sprache: kopfVon("sprache").sprache, kundeEmail: kopfVon("kundeEmail").kundeEmail, kopieEmail: kopfVon("kopieEmail").kopieEmail,
    bemerkung: kopfVon("bemerkung").bemerkung, beginnAt: kopfVon("beginnAt").beginnAt,
    mitarbeiterId: kopfVon("mitarbeiter").mitarbeiterId, mitarbeiterName: kopfVon("mitarbeiter").mitarbeiterName,
    commissionId: kopfVon("kommission").commissionId, kommissionNr: kopfVon("kommission").kommissionNr,
    teilnehmer: kopfVon("teilnehmer").teilnehmer,
    // Abschlussdaten und das lokal erzeugte PDF gehören zum Tablet-Stand.
    status: lokal.status, abgeschlossenAt: lokal.abgeschlossenAt, pdfPath: lokal.pdfPath ?? server.pdfPath,
  };

  // Räume
  const raumIds = new Set([...lokal.raeume.map((r) => r.id), ...server.raeume.map((r) => r.id)]);
  const raeume: Raum[] = [];
  for (const id of raumIds) {
    const r = quelle(`raum:${id}`).raeume.find((x) => x.id === id);
    if (r) raeume.push(r);
  }

  // Positionen samt Prüfpunkten
  const posIds = new Set([...lokal.positionen.map((p) => p.id), ...server.positionen.map((p) => p.id)]);
  const positionen: Position[] = [];
  for (const id of posIds) {
    const q = quelle(`pos:${id}`);
    const p = q.positionen.find((x) => x.id === id);
    if (!p) continue;
    const inBeiden = lokal.positionen.some((x) => x.id === id) && server.positionen.some((x) => x.id === id);
    let pruefpunkte: Pruefpunkt[] = p.pruefpunkte;
    if (inBeiden) {
      const lp = lokal.positionen.find((x) => x.id === id)!.pruefpunkte;
      const sp = server.positionen.find((x) => x.id === id)!.pruefpunkte;
      const ppIds = new Set([...lp.map((k) => k.id), ...sp.map((k) => k.id)]);
      pruefpunkte = [];
      for (const kid of ppIds) {
        const k = quelle(`pp:${id}:${kid}`).positionen.find((x) => x.id === id)?.pruefpunkte.find((x) => x.id === kid);
        if (k) pruefpunkte.push(k);
      }
      pruefpunkte = nummeriert(pruefpunkte);
    }
    const mitPP = { ...p, pruefpunkte };
    positionen.push(pruefpunkte.length > 0 ? { ...mitPP, status: positionStatus(mitPP) } : mitPP);
  }
  const posVorhanden = new Set(positionen.map((p) => p.id));
  const raumVorhanden = new Set(raeume.map((r) => r.id));
  const ppVorhanden = new Set(positionen.flatMap((p) => p.pruefpunkte.map((k) => k.id)));

  // Mängel, Fotos, Unterschriften
  const maengelIds = new Set([...lokal.maengel.map((m) => m.id), ...server.maengel.map((m) => m.id)]);
  const maengel: Mangel[] = [];
  for (const id of maengelIds) {
    const m = quelle(`mangel:${id}`).maengel.find((x) => x.id === id);
    if (!m) continue;
    if (m.positionId && !posVorhanden.has(m.positionId)) continue; // Position gelöscht → Mangel entfällt
    maengel.push({
      ...m,
      raumId: m.raumId && raumVorhanden.has(m.raumId) ? m.raumId : null,
      pruefpunktId: m.pruefpunktId && ppVorhanden.has(m.pruefpunktId) ? m.pruefpunktId : null,
    });
  }
  const mangelVorhanden = new Set(maengel.map((m) => m.id));
  const fotoIds = new Set([...lokal.fotos.map((f) => f.id), ...server.fotos.map((f) => f.id)]);
  const fotos: Foto[] = [];
  for (const id of fotoIds) {
    const q = quelle(`foto:${id}`);
    // Pfad bevorzugt vom Stand, der das Bild schon hochgeladen hat.
    const f = q.fotos.find((x) => x.id === id);
    const alt = (q === lokal ? server : lokal).fotos.find((x) => x.id === id);
    if (f && mangelVorhanden.has(f.mangelId)) fotos.push({ ...f, path: f.path ?? alt?.path ?? null });
  }
  const sigIds = new Set([...lokal.unterschriften.map((u) => u.id), ...server.unterschriften.map((u) => u.id)]);
  const unterschriften: Unterschrift[] = [];
  for (const id of sigIds) {
    const q = quelle(`sig:${id}`);
    const u = q.unterschriften.find((x) => x.id === id);
    const alt = (q === lokal ? server : lokal).unterschriften.find((x) => x.id === id);
    if (!u) continue;
    if (u.bezug === "raum" && u.bezugId && !raumVorhanden.has(u.bezugId)) continue;
    if (u.bezug === "position" && u.bezugId && !posVorhanden.has(u.bezugId)) continue;
    unterschriften.push({ ...u, bildPath: u.bildPath ?? alt?.bildPath ?? null });
  }

  return {
    ...doc,
    rev: server.rev,
    raeume: nummeriert(raeume),
    positionen: nummeriert(positionen.map((p) => ({ ...p, raumId: p.raumId && raumVorhanden.has(p.raumId) ? p.raumId : null }))),
    maengel: nummeriert(maengel),
    fotos,
    unterschriften,
  };
}
