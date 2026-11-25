"use client";

import { kommissionAnzeige } from "@/lib/abnahme/kommission";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLokalesProtokoll } from "@/lib/abnahme/offline/store";
import { loescheBlob, speichereBlob } from "@/lib/abnahme/offline/db";
import { komprimiereFoto } from "@/lib/abnahme/offline/images";
import {
  fortschritt, findeMangel, findeUnterschrift, maengelPositionen, offeneUnterschriften, positionStatus,
  raumAlleIo, relevantePositionen, setzeMangel, setzeMehrere, setzeStatus, setzeUnterschrift, type ItemRef,
  entfernePosition, entfernePruefpunkt, entferneRaum, entferneObjektFoto, fuegeObjektFotoHinzu, fuegePositionHinzu, fuegePruefpunktHinzu, istManuell, objektFotosVon,
} from "@/lib/abnahme/logic";
import type { Position, ProtokollDoc, Raum } from "@/lib/abnahme/types";
import { SignaturePad } from "../SignaturePad";
import { BlobImg } from "./BlobImg";
import { MangelDialog, type NeuesFoto } from "./MangelDialog";
import { SyncBadge, useAutoSync } from "./SyncBadge";
import { AbschlussView } from "./AbschlussView";
import { PositionDialog } from "./PositionDialog";

type View = { art: "uebersicht" } | { art: "raum"; index: number } | { art: "abschluss" };

function viewAusHash(hash: string, anzahlRaeume: number): View {
  if (hash === "#abschluss") return { art: "abschluss" };
  const m = /^#raum-(\d+)$/.exec(hash);
  if (m && Number(m[1]) < anzahlRaeume) return { art: "raum", index: Number(m[1]) };
  return { art: "uebersicht" };
}
const hashFuer = (v: View) => (v.art === "abschluss" ? "#abschluss" : v.art === "raum" ? `#raum-${v.index}` : "");

type MangelCtx = { ref: ItemRef; titel: string };
type SigCtx = {
  bezug: "raum" | "position" | "schluss_kunde" | "schluss_mitarbeiter";
  bezugId: string | null;
  titel: string;
  rolle: string;
  name: string;
};

export function Protokollansicht({ id }: { id: string }) {
  const online = useAutoSync();
  const { eintrag, doc, laedt, aendere, aendereEintrag } = useLokalesProtokoll(id);
  const [view, setViewState] = useState<View>({ art: "uebersicht" });
  const [mangelCtx, setMangelCtx] = useState<MangelCtx | null>(null);
  const [sigCtx, setSigCtx] = useState<SigCtx | null>(null);
  const [posRaum, setPosRaum] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState("");
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const gestartet = useRef(false);
  const anzahlRaeume = doc?.raeume.length ?? 0;

  // Ansicht über den URL-Hash steuern (Zurück-Taste des Geräts bleibt in der Begehung).
  useEffect(() => {
    const lesen = () => setViewState(viewAusHash(window.location.hash, anzahlRaeume));
    lesen();
    window.addEventListener("hashchange", lesen);
    return () => window.removeEventListener("hashchange", lesen);
  }, [anzahlRaeume]);
  const setView = useCallback((v: View) => {
    window.location.hash = hashFuer(v) || "#";
    setAuswahl(new Set());
  }, []);

  // Beginn der Begehung beim ersten Öffnen festhalten.
  useEffect(() => {
    if (doc && !doc.beginnAt && doc.status !== "abgeschlossen" && !gestartet.current) {
      gestartet.current = true;
      aendere((d) => ({ ...d, beginnAt: new Date().toISOString(), status: "in_arbeit" }));
    }
  }, [doc, aendere]);

  const gesperrt = doc?.status === "abgeschlossen";

  const setzeItem = useCallback(
    (ref: ItemRef, status: "io" | "nicht_pruefbar" | "offen") => {
      if (!doc) return;
      const r = setzeStatus(doc, ref, status);
      r.entfernteFotos.forEach((f) => void loescheBlob(f));
      aendere(() => r.doc);
    },
    [doc, aendere]
  );

  async function mangelSpeichern(ctx: MangelCtx, r: { text: string; frist: string; neueFotos: NeuesFoto[]; entfernteFotoIds: string[] }) {
    if (!doc) return;
    for (const f of r.neueFotos) {
      await speichereBlob({ id: f.id, docId: doc.id, art: "foto", mime: "image/jpeg", blob: f.blob, hochgeladen: false });
    }
    r.entfernteFotoIds.forEach((f) => void loescheBlob(f));
    aendere((d) => {
      const n = setzeMangel(d, ctx.ref, { text: r.text, frist: r.frist });
      const m = findeMangel(n, ctx.ref)!;
      return {
        ...n,
        fotos: [
          ...n.fotos.filter((f) => !r.entfernteFotoIds.includes(f.id)),
          ...r.neueFotos.map((f) => ({ id: f.id, mangelId: m.id, path: null, breite: f.breite, hoehe: f.hoehe, aufgenommenAt: new Date().toISOString() })),
        ],
      };
    });
    setMangelCtx(null);
  }

  /** Objektfotos (auch bei „i. O.“): komprimiert lokal speichern, der Sync lädt sie hoch. */
  async function objektFotosHinzu(positionId: string, dateien: File[]) {
    if (!doc) return;
    setHinweis("");
    try {
      for (const datei of dateien) {
        const k = await komprimiereFoto(datei);
        const fid = crypto.randomUUID();
        await speichereBlob({ id: fid, docId: doc.id, art: "foto", mime: "image/jpeg", blob: k.blob, hochgeladen: false });
        aendere((d) => fuegeObjektFotoHinzu(d, positionId, { id: fid, breite: k.breite, hoehe: k.hoehe }));
      }
    } catch (e) {
      setHinweis(e instanceof Error ? e.message : "Das Foto konnte nicht gespeichert werden.");
    }
  }
  function objektFotoWeg(fotoId: string) {
    void loescheBlob(fotoId);
    aendere((d) => entferneObjektFoto(d, fotoId));
  }

  async function unterschriftSpeichern(ctx: SigCtx, r: { blob: Blob; name: string }) {
    if (!doc) return;
    const uid = crypto.randomUUID();
    await speichereBlob({ id: uid, docId: doc.id, art: "unterschrift", mime: "image/png", blob: r.blob, hochgeladen: false });
    let ersetzt: string | null = null;
    aendere((d) => {
      const s = setzeUnterschrift(d, { id: uid, bezug: ctx.bezug, bezugId: ctx.bezugId, name: r.name, rolle: ctx.rolle });
      ersetzt = s.ersetzt;
      return s.doc;
    });
    if (ersetzt) void loescheBlob(ersetzt);
    setSigCtx(null);
  }

  /** Fachlogik kann ablehnen (z. B. Mangel als Ganzes) – Hinweis zeigen statt Absturz. */
  function sicher(fn: (d: ProtokollDoc) => ProtokollDoc) {
    setHinweis("");
    aendere((d) => {
      try {
        return fn(d);
      } catch (e) {
        setHinweis(e instanceof Error ? e.message : "Nicht möglich.");
        return d;
      }
    });
  }

  if (laedt) return <p className="aus-muted">Wird geladen …</p>;
  if (!eintrag || !doc) {
    return (
      <div className="aus-note" role="alert">
        <div className="aus-note-body">
          <p>Dieses Protokoll ist auf diesem Gerät nicht gespeichert.</p>
          <Link className="aus-btn aus-btn-secondary" href="/abnahme/begehung">Zur Liste</Link>
        </div>
      </div>
    );
  }

  const mangelDialog = mangelCtx && (
    <MangelDialog
      titel={mangelCtx.titel}
      mangel={findeMangel(doc, mangelCtx.ref) ?? null}
      fotos={doc.fotos.filter((f) => f.mangelId === findeMangel(doc, mangelCtx.ref)?.id)}
      komprimiere={(f) => komprimiereFoto(f)}
      onCancel={() => setMangelCtx(null)}
      onSave={(r) => mangelSpeichern(mangelCtx, r)}
    />
  );
  const posDialog = posRaum && (
    <PositionDialog
      raumName={doc.raeume.find((r) => r.id === posRaum)?.name ?? ""}
      onCancel={() => setPosRaum(null)}
      onSave={(p) => {
        sicher((d) => fuegePositionHinzu(d, posRaum, p));
        setPosRaum(null);
      }}
    />
  );
  const sigDialog = sigCtx && (
    <SignaturePad
      titel={sigCtx.titel}
      rolle={sigCtx.rolle}
      vorschlagName={sigCtx.name}
      onCancel={() => setSigCtx(null)}
      onSave={(r) => unterschriftSpeichern(sigCtx, r)}
    />
  );

  const kopf = (
    <header className="abn-bar">
      <div className="abn-bar-title">
        <span className="aus-mono">{kommissionAnzeige(doc.kommissionNr, "de")}</span> · {doc.kunde}
        {doc.titel && <span className="aus-muted"> · {doc.titel}</span>}
      </div>
      <SyncBadge eintrag={eintrag} online={online} />
    </header>
  );

  const navigation = (
    <nav className="abn-nav" aria-label="Begehung">
      <button type="button" className={`abn-nav-btn${view.art === "uebersicht" ? " is-active" : ""}`} onClick={() => setView({ art: "uebersicht" })}>Übersicht</button>
      {doc.raeume.map((r, i) => (
        <button key={r.id} type="button" className={`abn-nav-btn${view.art === "raum" && view.index === i ? " is-active" : ""}`} onClick={() => setView({ art: "raum", index: i })}>
          {r.name}
        </button>
      ))}
      <button type="button" className={`abn-nav-btn${view.art === "abschluss" ? " is-active" : ""}`} onClick={() => setView({ art: "abschluss" })}>
        {gesperrt ? "Dokument" : "Abschluss"}
      </button>
    </nav>
  );

  return (
    <div className="abn-begehung">
      {kopf}
      {gesperrt && (
        <div className="aus-note" role="status">
          <div className="aus-note-body"><p>Dieses Protokoll ist abgeschlossen und gesperrt. Änderungen nur über einen Nachtrag.</p></div>
        </div>
      )}
      {navigation}

      {view.art === "uebersicht" && <Uebersicht doc={doc} onRaum={(i) => setView({ art: "raum", index: i })} onAbschluss={() => setView({ art: "abschluss" })} />}

      {view.art === "raum" && doc.raeume[view.index] && (
        <RaumSeite
          doc={doc}
          raum={doc.raeume[view.index]}
          index={view.index}
          gesperrt={gesperrt}
          auswahl={auswahl}
          setAuswahl={setAuswahl}
          onItem={setzeItem}
          onNeuePosition={() => setPosRaum(doc.raeume[view.index].id)}
          onNeuerPunkt={(pid, text) => sicher((d) => fuegePruefpunktHinzu(d, pid, text))}
          onPunktWeg={(pid, kid) => {
            const r = entfernePruefpunkt(doc, pid, kid);
            r.entfernteFotos.forEach((f) => void loescheBlob(f));
            aendere(() => r.doc);
          }}
          onPositionWeg={(pid) => {
            if (!window.confirm("Diese selbst angelegte Position entfernen?")) return;
            try {
              const r = entfernePosition(doc, pid);
              r.entfernteBilder.forEach((f) => void loescheBlob(f));
              aendere(() => r.doc);
            } catch (e) {
              setHinweis(e instanceof Error ? e.message : "Nicht möglich.");
            }
          }}
          onObjektFotos={objektFotosHinzu}
          onObjektFotoWeg={objektFotoWeg}
          onMangel={(ref, titel) => setMangelCtx({ ref, titel })}
          onAlleIo={() => aendere((d) => raumAlleIo(d, doc.raeume[view.index].id))}
          onMehrere={(status) => {
            aendere((d) => setzeMehrere(d, Array.from(auswahl), status));
            setAuswahl(new Set());
          }}
          onRaumAendern={(patch) => aendere((d) => ({ ...d, raeume: d.raeume.map((r) => (r.id === doc.raeume[view.index].id ? { ...r, ...patch } : r)) }))}
          onRaumLoeschen={() => {
            const raum = doc.raeume[view.index];
            const n = doc.positionen.filter((p) => p.raumId === raum.id).length;
            if (!window.confirm(`Raum „${raum.name}“ mit ${n} Position${n === 1 ? "" : "en"} samt Mängeln, Fotos und Unterschriften löschen? Das lässt sich nicht rückgängig machen.`)) return;
            try {
              const r = entferneRaum(doc, raum.id);
              r.entfernteBilder.forEach((f) => void loescheBlob(f));
              aendere(() => r.doc);
              setView({ art: "uebersicht" });
            } catch (e) {
              setHinweis(e instanceof Error ? e.message : "Nicht möglich.");
            }
          }}
          onBemerkung={(text) => aendere((d) => ({ ...d, raeume: d.raeume.map((r) => (r.id === doc.raeume[view.index].id ? { ...r, bemerkung: text } : r)) }))}
          onSign={(bezug, bezugId, titel) =>
            setSigCtx({ bezug, bezugId, titel, rolle: "Kunde", name: letzterKundenName(doc) })
          }
          onNavigiere={(i) => (i < 0 ? setView({ art: "uebersicht" }) : i >= doc.raeume.length ? setView({ art: "abschluss" }) : setView({ art: "raum", index: i }))}
        />
      )}

      {view.art === "abschluss" && (
        <AbschlussView
          eintrag={eintrag}
          online={online}
          onAendere={aendere}
          onAendereEintrag={aendereEintrag}
          onSign={(bezug, titel, rolle, name) => setSigCtx({ bezug, bezugId: null, titel, rolle, name })}
        />
      )}

      {hinweis && <p className="aus-field-error" role="alert">{hinweis}</p>}
      {mangelDialog}
      {posDialog}
      {sigDialog}
    </div>
  );
}

function letzterKundenName(doc: ProtokollDoc): string {
  const u = [...doc.unterschriften].reverse().find((x) => x.rolle === "Kunde");
  return u?.name ?? "";
}

function Uebersicht({ doc, onRaum, onAbschluss }: { doc: ProtokollDoc; onRaum: (i: number) => void; onAbschluss: () => void }) {
  const gesamt = fortschritt(relevantePositionen(doc));
  const offeneU = offeneUnterschriften(doc);
  return (
    <section className="abn-uebersicht">
      <div className="aus-card">
        <dl className="aus-kv">
          <dt>Kommission</dt><dd>{kommissionAnzeige(doc.kommissionNr, "de")}</dd>
          <dt>Kunde</dt><dd>{doc.kunde}</dd>
          {doc.projekt && (<><dt>Projekt</dt><dd>{doc.projekt}</dd></>)}
          {doc.ort && (<><dt>Ort</dt><dd>{doc.ort}</dd></>)}
          <dt>Mitarbeiter</dt><dd>{doc.mitarbeiterName}</dd>
        </dl>
        <FortschrittZeile f={gesamt} />
        <p className="aus-muted">
          {offeneU.raeume.length + offeneU.positionen.length === 0
            ? "Alle Unterschriften vorhanden."
            : `${offeneU.raeume.length} Raum-Unterschrift(en) und ${offeneU.positionen.length} Mangel-Unterschrift(en) offen.`}
        </p>
      </div>
      <ul className="abn-raumliste">
        {doc.raeume.map((r, i) => {
          const f = fortschritt(relevantePositionen(doc, r.id));
          const signiert = Boolean(findeUnterschrift(doc, "raum", r.id));
          return (
            <li key={r.id}>
              <button type="button" className="abn-raumkarte" onClick={() => onRaum(i)}>
                <span className="abn-raumname">{r.etage ? `${r.etage} · ` : ""}{r.name}</span>
                <FortschrittZeile f={f} kompakt />
                <span className={signiert ? "abn-chip is-ok" : "abn-chip"}>{signiert ? "unterschrieben" : "Unterschrift offen"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="aus-actions">
        <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" onClick={onAbschluss}>Zum Abschluss</button>
      </div>
    </section>
  );
}

function FortschrittZeile({ f, kompakt }: { f: ReturnType<typeof fortschritt>; kompakt?: boolean }) {
  return (
    <div className={kompakt ? "abn-fort is-compact" : "abn-fort"}>
      <span className="abn-chip">offen {f.offen}</span>
      <span className="abn-chip is-ok">i. O. {f.io}</span>
      <span className={f.mangel ? "abn-chip is-bad" : "abn-chip"}>Mangel {f.mangel}</span>
      {f.nichtPruefbar > 0 && <span className="abn-chip">nicht prüfbar {f.nichtPruefbar}</span>}
    </div>
  );
}

/** Symbole der Statusknöpfe: Haken = i. O., Hammer = Mangel, X = nicht prüfbar. */
function StatusIcon({ art }: { art: "io" | "mangel" | "nicht" }) {
  const pfade =
    art === "io"
      ? ["M20 6 9 17l-5-5"]
      : art === "nicht"
        ? ["M18 6 6 18", "m6 6 12 12"]
        : [
            "m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9",
            "m18 15 4-4",
            "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5",
          ];
  return (
    <svg className="abn-st-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {pfade.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function StatusKnoepfe({
  status, gesperrt, onIo, onMangel, onNicht,
}: { status: string; gesperrt: boolean; onIo: () => void; onMangel: () => void; onNicht: () => void }) {
  return (
    <div className="abn-status" role="group" aria-label="Status">
      <button type="button" disabled={gesperrt} className={`abn-st is-io${status === "io" ? " on" : ""}`} onClick={onIo}><StatusIcon art="io" />i. O.</button>
      <button type="button" disabled={gesperrt} className={`abn-st is-mangel${status === "mangel" ? " on" : ""}`} onClick={onMangel}><StatusIcon art="mangel" />Mangel</button>
      <button type="button" disabled={gesperrt} className={`abn-st is-nicht${status === "nicht_pruefbar" ? " on" : ""}`} onClick={onNicht}><StatusIcon art="nicht" />nicht prüfbar</button>
    </div>
  );
}

function RaumSeite({
  doc, raum, index, gesperrt, auswahl, setAuswahl, onItem, onMangel, onAlleIo, onMehrere, onBemerkung, onSign, onNavigiere,
  onObjektFotos, onObjektFotoWeg, onRaumAendern, onRaumLoeschen, onNeuePosition, onNeuerPunkt, onPunktWeg, onPositionWeg,
}: {
  onObjektFotos: (positionId: string, dateien: File[]) => void;
  onObjektFotoWeg: (fotoId: string) => void;
  onRaumAendern: (patch: Partial<Raum>) => void;
  onRaumLoeschen: () => void;
  onNeuePosition: () => void;
  onNeuerPunkt: (positionId: string, text: string) => void;
  onPunktWeg: (positionId: string, pruefpunktId: string) => void;
  onPositionWeg: (positionId: string) => void;
  doc: ProtokollDoc;
  raum: Raum;
  index: number;
  gesperrt: boolean;
  auswahl: Set<string>;
  setAuswahl: (s: Set<string>) => void;
  onItem: (ref: ItemRef, status: "io" | "nicht_pruefbar" | "offen") => void;
  onMangel: (ref: ItemRef, titel: string) => void;
  onAlleIo: () => void;
  onMehrere: (status: "io" | "nicht_pruefbar") => void;
  onBemerkung: (text: string) => void;
  onSign: (bezug: "raum" | "position", bezugId: string, titel: string) => void;
  onNavigiere: (i: number) => void;
}) {
  const positionen = useMemo(() => relevantePositionen(doc, raum.id), [doc, raum.id]);
  const f = fortschritt(positionen);
  const start = useRef<{ x: number; y: number } | null>(null);
  const raumSig = findeUnterschrift(doc, "raum", raum.id);

  function toggle(id: string) {
    const n = new Set(auswahl);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setAuswahl(n);
  }

  return (
    <section
      className="abn-raum-seite"
      onPointerDown={(e) => {
        const ziel = e.target as HTMLElement;
        if (e.pointerType === "mouse" || ziel.closest("button, input, textarea, select, summary, canvas, a")) return;
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2) onNavigiere(index + (dx < 0 ? 1 : -1));
      }}
    >
      <h2 className="aus-h2">{raum.etage ? `${raum.etage} · ` : ""}{raum.name}</h2>
      {!gesperrt && (
        <details className="abn-raum-menue">
          <summary>Raum bearbeiten</summary>
          <div className="abn-raum-menue-body">
            <label className="aus-field">
              <span className="aus-label">Raumname</span>
              <input className="aus-input" value={raum.name} onChange={(e) => onRaumAendern({ name: e.target.value })} />
            </label>
            <label className="aus-field">
              <span className="aus-label">Etage</span>
              <input className="aus-input" value={raum.etage} placeholder="EG, OG …" onChange={(e) => onRaumAendern({ etage: e.target.value })} />
            </label>
            <button type="button" className="aus-btn aus-btn-quiet aus-btn-sm abn-raum-loeschen" onClick={onRaumLoeschen}>Raum löschen</button>
          </div>
        </details>
      )}
      {raum.materialText && (
        <details className="abn-material" open>
          <summary>Materialangaben</summary>
          <pre className="abn-pre">{raum.materialText}</pre>
        </details>
      )}
      <FortschrittZeile f={f} />

      {!gesperrt && (
        <div className="abn-bulk">
          <button type="button" className="aus-btn aus-btn-primary" onClick={onAlleIo} disabled={f.offen === 0}>Alle Positionen im Raum i. O.</button>
          {auswahl.size > 0 && (
            <>
              <span>{auswahl.size} gewählt:</span>
              <button type="button" className="aus-btn aus-btn-secondary" onClick={() => onMehrere("io")}>i. O.</button>
              <button type="button" className="aus-btn aus-btn-secondary" onClick={() => onMehrere("nicht_pruefbar")}>nicht prüfbar</button>
              <button type="button" className="aus-btn aus-btn-quiet" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>
            </>
          )}
        </div>
      )}

      {positionen.length === 0 && <p className="aus-muted">Keine abnahmerelevanten Positionen in diesem Raum.</p>}
      <ul className="abn-pos-liste">
        {positionen.map((p) => (
          <PositionKarte
            key={p.id}
            doc={doc}
            pos={p}
            gesperrt={gesperrt}
            gewaehlt={auswahl.has(p.id)}
            onToggle={() => toggle(p.id)}
            onItem={onItem}
            onMangel={onMangel}
            onSign={() => onSign("position", p.id, `Mangel: ${p.titel}`)}
            onNeuerPunkt={(text) => onNeuerPunkt(p.id, text)}
            onPunktWeg={(kid) => onPunktWeg(p.id, kid)}
            onPositionWeg={() => onPositionWeg(p.id)}
            onObjektFotos={(dateien) => onObjektFotos(p.id, dateien)}
            onObjektFotoWeg={onObjektFotoWeg}
          />
        ))}
      </ul>
      {!gesperrt && (
        <div className="aus-actions">
          <button type="button" className="aus-btn aus-btn-secondary" onClick={onNeuePosition}>+ Eigene Position hinzufügen</button>
        </div>
      )}

      <label className="aus-field">
        <span className="aus-label">Bemerkung zum Raum</span>
        <textarea className="aus-textarea" rows={3} disabled={gesperrt} value={raum.bemerkung} onChange={(e) => onBemerkung(e.target.value)} />
      </label>

      <div className="abn-sig-zeile">
        <strong>Unterschrift Raum</strong>
        {raumSig ? (
          <span className="abn-sig-ok"><BlobImg id={raumSig.id} alt={`Unterschrift ${raumSig.name}`} className="abn-sig-img" /> {raumSig.name}</span>
        ) : (
          <span className="aus-muted">fehlt</span>
        )}
        {!gesperrt && (
          <button type="button" className="aus-btn aus-btn-secondary" onClick={() => onSign("raum", raum.id, `Unterschrift Raum: ${raum.name}`)}>
            {raumSig ? "Neu unterschreiben" : "Unterschreiben"}
          </button>
        )}
      </div>

      <div className="abn-pager">
        <button type="button" className="aus-btn aus-btn-secondary aus-btn-lg" onClick={() => onNavigiere(index - 1)}>← {index === 0 ? "Übersicht" : "Zurück"}</button>
        <button type="button" className="aus-btn aus-btn-primary aus-btn-lg" onClick={() => onNavigiere(index + 1)}>
          {index + 1 >= doc.raeume.length ? "Zum Abschluss →" : "Nächster Raum →"}
        </button>
      </div>
    </section>
  );
}

function PositionKarte({
  doc, pos, gesperrt, gewaehlt, onToggle, onItem, onMangel, onSign, onNeuerPunkt, onPunktWeg, onPositionWeg, onObjektFotos, onObjektFotoWeg,
}: {
  onObjektFotos: (dateien: File[]) => void;
  onObjektFotoWeg: (fotoId: string) => void;
  onNeuerPunkt: (text: string) => void;
  onPunktWeg: (pruefpunktId: string) => void;
  onPositionWeg: () => void;
  doc: ProtokollDoc;
  pos: Position;
  gesperrt: boolean;
  gewaehlt: boolean;
  onToggle: () => void;
  onItem: (ref: ItemRef, status: "io" | "nicht_pruefbar" | "offen") => void;
  onMangel: (ref: ItemRef, titel: string) => void;
  onSign: () => void;
}) {
  const status = positionStatus(pos);
  const ganz: ItemRef = { positionId: pos.id, pruefpunktId: null };
  const posSig = findeUnterschrift(doc, "position", pos.id);
  const mitMangel = maengelPositionen(doc).some((p) => p.id === pos.id);
  const mangelListe = doc.maengel.filter((m) => m.positionId === pos.id);
  const [neuerPunkt, setNeuerPunkt] = useState("");
  const objektFotos = objektFotosVon(doc, pos.id);

  return (
    <li className={`abn-pos-karte s-${status}`}>
      <div className="abn-pos-kopf">
        {!gesperrt && (
          <label className="abn-check" aria-label={`Position ${pos.nr} auswählen`}>
            <input type="checkbox" checked={gewaehlt} onChange={onToggle} />
          </label>
        )}
        <div className="abn-pos-text">
          <div className="abn-pos-titel"><span className="aus-mono">{pos.nr}</span> {pos.titel}</div>
          {(pos.menge || pos.einheit) && <div className="aus-muted">{pos.menge} {pos.einheit}</div>}
        </div>
        <span className={`abn-chip s-${status}`}>{status === "io" ? "i. O." : status === "mangel" ? "Mangel" : status === "nicht_pruefbar" ? "nicht prüfbar" : "offen"}</span>
      </div>
      {pos.langtext && (
        <details className="abn-langtext">
          <summary>Langtext</summary>
          <pre className="abn-pre">{pos.langtext}</pre>
        </details>
      )}

      {pos.pruefpunkte.length === 0 ? (
        <StatusKnoepfe
          status={pos.status}
          gesperrt={gesperrt}
          onIo={() => onItem(ganz, "io")}
          onMangel={() => onMangel(ganz, pos.titel)}
          onNicht={() => onItem(ganz, "nicht_pruefbar")}
        />
      ) : (
        <ul className="abn-pruef">
          {pos.pruefpunkte.map((k) => {
            const ref: ItemRef = { positionId: pos.id, pruefpunktId: k.id };
            return (
              <li key={k.id}>
                <span className="abn-pruef-text">
                  {k.textDe}
                  {!gesperrt && (
                    <button type="button" className="abn-weg" aria-label={`Prüfpunkt „${k.textDe}“ entfernen`} title="Prüfpunkt entfernen" onClick={() => onPunktWeg(k.id)}>×</button>
                  )}
                </span>
                <StatusKnoepfe
                  status={k.status}
                  gesperrt={gesperrt}
                  onIo={() => onItem(ref, "io")}
                  onMangel={() => onMangel(ref, `${pos.titel} – ${k.textDe}`)}
                  onNicht={() => onItem(ref, "nicht_pruefbar")}
                />
              </li>
            );
          })}
        </ul>
      )}

      {(!gesperrt || objektFotos.length > 0) && (
        <div className="abn-objektfoto">
          <div className="abn-objektfoto-kopf">
            <span className="abn-objektfoto-titel">Foto vom Objekt</span>
            {!gesperrt && (
              <label className="aus-btn aus-btn-secondary aus-btn-sm abn-objektfoto-btn">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                Foto aufnehmen
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="abn-objektfoto-input"
                  onChange={(e) => {
                    const dateien = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (dateien.length) onObjektFotos(dateien);
                  }}
                />
              </label>
            )}
            {!gesperrt && status === "io" && objektFotos.length === 0 && <span className="abn-muted">i. O.: bitte das Objekt fotografieren</span>}
          </div>
          {objektFotos.length > 0 && (
            <div className="abn-fotos">
              {objektFotos.map((f) => (
                <span className="abn-objektfoto-item" key={f.id}>
                  <BlobImg id={f.id} alt={`Foto ${pos.titel}`} className="abn-foto" />
                  {!gesperrt && (
                    <button type="button" className="abn-objektfoto-weg" aria-label="Foto entfernen" title="Foto entfernen" onClick={() => onObjektFotoWeg(f.id)}>×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!gesperrt && (
        <div className="abn-punkt-neu">
          <input className="aus-input" placeholder="Prüfpunkt hinzufügen …" value={neuerPunkt} onChange={(e) => setNeuerPunkt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && neuerPunkt.trim()) { onNeuerPunkt(neuerPunkt); setNeuerPunkt(""); } }} />
          <button type="button" className="aus-btn aus-btn-secondary" disabled={!neuerPunkt.trim()} onClick={() => { onNeuerPunkt(neuerPunkt); setNeuerPunkt(""); }}>Hinzufügen</button>
          {istManuell(pos) && <button type="button" className="aus-btn aus-btn-quiet" onClick={onPositionWeg}>Position entfernen</button>}
        </div>
      )}

      {mangelListe.map((m) => (
        <div className="abn-mangel" key={m.id}>
          <p><strong>Mangel:</strong> {m.text}{m.frist && <span className="aus-muted"> · Frist {m.frist}</span>}</p>
          <div className="abn-fotos">
            {doc.fotos.filter((f) => f.mangelId === m.id).map((f) => <BlobImg key={f.id} id={f.id} alt="Foto zum Mangel" className="abn-foto" />)}
          </div>
          {!gesperrt && (
            <button
              type="button"
              className="aus-btn aus-btn-quiet aus-btn-sm"
              onClick={() => onMangel({ positionId: m.positionId!, pruefpunktId: m.pruefpunktId }, m.pruefpunktId ? pos.titel : pos.titel)}
            >
              Mangel bearbeiten
            </button>
          )}
        </div>
      ))}

      {mitMangel && (
        <div className="abn-sig-zeile">
          <strong>Unterschrift zum Mangel</strong>
          {posSig ? (
            <span className="abn-sig-ok"><BlobImg id={posSig.id} alt={`Unterschrift ${posSig.name}`} className="abn-sig-img" /> {posSig.name}</span>
          ) : (
            <span className="aus-muted">fehlt</span>
          )}
          {!gesperrt && (
            <button type="button" className="aus-btn aus-btn-secondary" onClick={onSign}>{posSig ? "Neu unterschreiben" : "Unterschreiben"}</button>
          )}
        </div>
      )}
    </li>
  );
}
