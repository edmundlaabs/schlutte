import type {
  Foto, Mangel, ObjektFoto, Position, ProtokollDoc, ProtokollVorlage, Pruefpunkt, Quelle, Raum, Unterschrift, Teilnehmer, Vorlage,
  VorlagePosition, VorlageRaum,
} from "./types.ts";

/** Zeilen der abnahme_*-Tabellen (snake_case) ⇄ Dokumentmodell. */
type Row = Record<string, unknown>;

export type ProtokollRows = {
  protokoll: Row;
  raeume: Row[];
  positionen: Row[];
  pruefpunkte: Row[];
  maengel: Row[];
  fotos: Row[];
  objektfotos?: Row[];
  unterschriften: Row[];
};

const nn = (s: string): string | null => (s.trim() === "" ? null : s);

export function docToRows(doc: ProtokollDoc): ProtokollRows {
  const pid = doc.id;
  return {
    protokoll: {
      id: pid,
      commission_id: doc.commissionId,
      kommission_nr: nn(doc.kommissionNr.trim()),
      kunde: doc.kunde.trim(),
      projekt: nn(doc.projekt),
      titel: nn(doc.titel),
      ort: nn(doc.ort),
      sprache: doc.sprache,
      status: doc.status,
      quelle: doc.quelle ?? "profacto",
      version: doc.version,
      parent_id: doc.parentId,
      mitarbeiter_id: doc.mitarbeiterId,
      mitarbeiter_name: nn(doc.mitarbeiterName),
      teilnehmer: doc.teilnehmer.map((t) => ({ name: t.name, rolle: t.rolle ?? null, employee_id: t.employeeId ?? null })),
      kunde_email: nn(doc.kundeEmail),
      kopie_email: nn(doc.kopieEmail),
      bemerkung: nn(doc.bemerkung),
      beginn_at: doc.beginnAt,
      abgeschlossen_at: doc.abgeschlossenAt,
      original_path: doc.originalPath,
      pdf_path: doc.pdfPath,
      // Der Token kommt vom Gerät (Abschluss). public_aktiv/-widerrufen_at setzt nur das Büro, nie der Sync.
      public_token: doc.publicToken ?? null,
      public_erstellt_at: doc.publicErstelltAt ?? null,
    },
    raeume: doc.raeume.map((r) => ({
      id: r.id, protokoll_id: pid, sort: r.sort, name: r.name, etage: nn(r.etage),
      material_text: nn(r.materialText), bemerkung: nn(r.bemerkung),
    })),
    positionen: doc.positionen.map((p) => ({
      id: p.id, protokoll_id: pid, raum_id: p.raumId, sort: p.sort, nr: nn(p.nr), menge: nn(p.menge),
      einheit: nn(p.einheit), artikel: nn(p.artikel), titel: p.titel, langtext: nn(p.langtext),
      relevant: p.relevant, vorlage_id: p.vorlageId, status: p.status, bemerkung: nn(p.bemerkung),
    })),
    pruefpunkte: doc.positionen.flatMap((p) =>
      p.pruefpunkte.map((k) => ({
        id: k.id, protokoll_id: pid, position_id: p.id, sort: k.sort, text_de: k.textDe,
        text_en: nn(k.textEn), status: k.status, bemerkung: nn(k.bemerkung),
      }))
    ),
    maengel: doc.maengel.map((m) => ({
      id: m.id, protokoll_id: pid, raum_id: m.raumId, position_id: m.positionId,
      pruefpunkt_id: m.pruefpunktId, sort: m.sort, text: m.text, frist: nn(m.frist), erledigt_at: m.erledigtAt,
    })),
    fotos: doc.fotos
      .filter((f) => f.path)
      .map((f) => ({
        id: f.id, protokoll_id: pid, mangel_id: f.mangelId, path: f.path, breite: f.breite,
        hoehe: f.hoehe, aufgenommen_at: f.aufgenommenAt,
      })),
    objektfotos: (doc.objektFotos ?? [])
      .filter((f) => f.path && doc.positionen.some((p) => p.id === f.positionId))
      .map((f) => ({
        id: f.id, protokoll_id: pid, position_id: f.positionId, path: f.path, breite: f.breite,
        hoehe: f.hoehe, aufgenommen_at: f.aufgenommenAt,
      })),
    unterschriften: doc.unterschriften
      .filter((u) => u.bildPath)
      .map((u) => ({
        id: u.id, protokoll_id: pid, bezug: u.bezug, bezug_id: u.bezugId, name: u.name,
        rolle: nn(u.rolle), bild_path: u.bildPath, zeitpunkt: u.zeitpunkt,
      })),
  };
}

export function zuQuelle(v: unknown): Quelle {
  return v === "manuell" || v === "vorlage" ? v : "profacto";
}

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const sn = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function rowsToDoc(rows: ProtokollRows): ProtokollDoc {
  const p = rows.protokoll;
  const pruefByPos = new Map<string, Pruefpunkt[]>();
  for (const r of rows.pruefpunkte) {
    const k: Pruefpunkt = {
      id: s(r.id), sort: Number(r.sort ?? 0), textDe: s(r.text_de), textEn: s(r.text_en),
      status: (r.status as Pruefpunkt["status"]) ?? "offen", bemerkung: s(r.bemerkung),
    };
    const list = pruefByPos.get(s(r.position_id)) ?? [];
    list.push(k);
    pruefByPos.set(s(r.position_id), list);
  }
  const raeume: Raum[] = rows.raeume
    .map((r) => ({
      id: s(r.id), sort: Number(r.sort ?? 0), name: s(r.name), etage: s(r.etage),
      materialText: s(r.material_text), bemerkung: s(r.bemerkung),
    }))
    .sort((a, b) => a.sort - b.sort);
  const positionen: Position[] = rows.positionen
    .map((r) => ({
      id: s(r.id), raumId: sn(r.raum_id), sort: Number(r.sort ?? 0), nr: s(r.nr), menge: s(r.menge),
      einheit: s(r.einheit), artikel: s(r.artikel), titel: s(r.titel), langtext: s(r.langtext),
      relevant: r.relevant !== false, vorlageId: sn(r.vorlage_id),
      status: (r.status as Position["status"]) ?? "offen", bemerkung: s(r.bemerkung),
      pruefpunkte: (pruefByPos.get(s(r.id)) ?? []).sort((a, b) => a.sort - b.sort),
    }))
    .sort((a, b) => a.sort - b.sort);
  const maengel: Mangel[] = rows.maengel
    .map((r) => ({
      id: s(r.id), raumId: sn(r.raum_id), positionId: sn(r.position_id), pruefpunktId: sn(r.pruefpunkt_id),
      sort: Number(r.sort ?? 0), text: s(r.text), frist: s(r.frist), erledigtAt: sn(r.erledigt_at),
    }))
    .sort((a, b) => a.sort - b.sort);
  const fotos: Foto[] = rows.fotos.map((r) => ({
    id: s(r.id), mangelId: s(r.mangel_id), path: sn(r.path), breite: Number(r.breite ?? 0),
    hoehe: Number(r.hoehe ?? 0), aufgenommenAt: s(r.aufgenommen_at),
  }));
  const objektFotos: ObjektFoto[] = (rows.objektfotos ?? []).map((r) => ({
    id: s(r.id), positionId: s(r.position_id), path: sn(r.path), breite: Number(r.breite ?? 0),
    hoehe: Number(r.hoehe ?? 0), aufgenommenAt: s(r.aufgenommen_at),
  }));
  const unterschriften: Unterschrift[] = rows.unterschriften.map((r) => ({
    id: s(r.id), bezug: r.bezug as Unterschrift["bezug"], bezugId: sn(r.bezug_id), name: s(r.name),
    rolle: s(r.rolle), bildPath: sn(r.bild_path), zeitpunkt: s(r.zeitpunkt),
  }));
  const teilnehmer: Teilnehmer[] = Array.isArray(p.teilnehmer)
    ? (p.teilnehmer as Row[]).map((t) => ({
        name: s(t.name), rolle: s(t.rolle) || undefined, employeeId: s(t.employee_id) || undefined,
      }))
    : [];
  return {
    id: s(p.id), commissionId: sn(p.commission_id), kommissionNr: s(p.kommission_nr), kunde: s(p.kunde),
    projekt: s(p.projekt), titel: s(p.titel), ort: s(p.ort), sprache: p.sprache === "en" ? "en" : "de",
    status: (p.status as ProtokollDoc["status"]) ?? "bereit", quelle: zuQuelle(p.quelle), version: Number(p.version ?? 1),
    parentId: sn(p.parent_id), mitarbeiterId: sn(p.mitarbeiter_id), mitarbeiterName: s(p.mitarbeiter_name),
    teilnehmer, kundeEmail: s(p.kunde_email), kopieEmail: s(p.kopie_email), bemerkung: s(p.bemerkung),
    beginnAt: sn(p.beginn_at), abgeschlossenAt: sn(p.abgeschlossen_at), originalPath: sn(p.original_path),
    pdfPath: sn(p.pdf_path),
    publicToken: sn(p.public_token), publicAktiv: p.public_aktiv !== false, publicErstelltAt: sn(p.public_erstellt_at),
    rev: Number(p.rev ?? 0), raeume, positionen, maengel, fotos, objektFotos, unterschriften,
  };
}

export function rowToVorlage(r: Row): Vorlage {
  const punkte = Array.isArray(r.punkte) ? (r.punkte as Row[]).map((x) => ({ de: s(x.de), en: s(x.en) })) : [];
  return {
    id: s(r.id), moebeltyp: s(r.moebeltyp), titelDe: s(r.titel_de), titelEn: s(r.titel_en), punkte,
    aktiv: r.aktiv !== false, sort: Number(r.sort ?? 0),
  };
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function rowToProtokollVorlage(r: Row): ProtokollVorlage {
  const struktur = (r.struktur ?? {}) as Row;
  const raeume: VorlageRaum[] = Array.isArray(struktur.raeume)
    ? (struktur.raeume as Row[]).map((ra) => ({
        name: text(ra.name), etage: text(ra.etage), materialText: text(ra.materialText),
        positionen: Array.isArray(ra.positionen)
          ? (ra.positionen as Row[]).map((po): VorlagePosition => ({
              titel: text(po.titel), einheit: text(po.einheit), beschreibung: text(po.beschreibung),
              vorlageId: typeof po.vorlageId === "string" ? po.vorlageId : null,
              pruefpunkte: Array.isArray(po.pruefpunkte)
                ? (po.pruefpunkte as Row[]).map((k) => ({ de: text(k.de), en: text(k.en) }))
                : [],
            }))
          : [],
      }))
    : [];
  return {
    id: s(r.id), titelDe: s(r.titel_de), titelEn: s(r.titel_en), beschreibung: s(r.beschreibung), raeume,
    aktiv: r.aktiv !== false, sort: Number(r.sort ?? 0),
  };
}

export function protokollVorlageToRow(v: Pick<ProtokollVorlage, "titelDe" | "titelEn" | "beschreibung" | "raeume" | "aktiv" | "sort">): Row {
  return {
    titel_de: v.titelDe.trim(),
    titel_en: v.titelEn.trim() || v.titelDe.trim(),
    beschreibung: nn(v.beschreibung),
    struktur: { raeume: v.raeume },
    aktiv: v.aktiv,
    sort: Math.trunc(v.sort) || 0,
  };
}
