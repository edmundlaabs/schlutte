import { headers } from "next/headers";
import { notFound } from "next/navigation";
import "@/styles/public.css";
import { ladePublicProtokoll } from "@/lib/data/abnahme-public";
import { istPublicToken } from "@/lib/abnahme/public-token";
import { istGesperrt, meldeFehlversuch } from "@/lib/abnahme/public-rate-limit";
import { hatKommission, kommissionAnzeige } from "@/lib/abnahme/kommission";
import { formatDatum, formatDatumZeit, t } from "@/lib/abnahme/i18n";
import { pt } from "@/lib/abnahme/public-texte";
import { FotoGalerie } from "@/components/public/FotoGalerie";
import type { PublicFoto, PublicMangel, PublicPosition, PublicRaum, PublicSignatur } from "@/lib/abnahme/public-view";

export const dynamic = "force-dynamic";

type L = ReturnType<typeof t>;
type P = ReturnType<typeof pt>;

export default async function PublicProtokollSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unbekannt";
  if (istGesperrt(ip)) notFound();
  const m = istPublicToken(token) ? await ladePublicProtokoll(token).catch(() => null) : null;
  if (!m) {
    meldeFehlversuch(ip);
    notFound();
  }
  const L = t(m.sprache);
  const T = pt(m.sprache);
  const komm = hatKommission({ kommissionNr: m.kommission }) ? kommissionAnzeige(m.kommission, m.sprache) : kommissionAnzeige("", m.sprache);
  const offene = m.maengel.filter((x) => !x.erledigt).length;

  return (
    <div className="pub" lang={m.sprache}>
      <FotoGalerie text={{ schliessen: T.schliessen, zurueck: T.zurueck, weiter: T.weiter, zoom: T.zoom }}>
        <header className="pub-kopf">
          <div className="pub-wrap pub-kopf-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pub-logo" src="/brand/grabner-logo.svg" alt="Grabner Design" />
            {m.hatPdf && (
              <a className="pub-btn" href={`/p/${token}/pdf`} rel="nofollow">
                {T.pdf}
              </a>
            )}
          </div>
        </header>

        <main className="pub-wrap">
          <p className="pub-eyebrow">{L.protokoll}{m.version > 1 ? ` · ${T.version} ${m.version}` : ""}</p>
          <h1 className="pub-h1">{m.kunde}</h1>
          {m.titel && <p className="pub-lede">{m.titel}</p>}

          <dl className="pub-kv">
            <dt>{L.kommission}</dt><dd>{komm}</dd>
            <dt>{L.kunde}</dt><dd>{m.kunde}</dd>
            {m.projekt && (<><dt>{L.projekt}</dt><dd>{m.projekt}</dd></>)}
            {m.ort && (<><dt>{L.ort}</dt><dd>{m.ort}</dd></>)}
            <dt>{L.datum}</dt><dd>{formatDatumZeit(m.datum, m.sprache)}</dd>
            {m.mitarbeiter && (<><dt>{L.mitarbeiter}</dt><dd>{m.mitarbeiter}</dd></>)}
            {m.teilnehmer.length > 0 && (
              <>
                <dt>{L.teilnehmer}</dt>
                <dd>{m.teilnehmer.map((x) => (x.rolle ? `${x.name} (${x.rolle})` : x.name)).join(", ")}</dd>
              </>
            )}
          </dl>

          {/* 1. Gesamtübersicht */}
          <section className="pub-sek" aria-labelledby="pub-uebersicht">
            <h2 id="pub-uebersicht" className="pub-h2"><span>1</span> {L.uebersicht}</h2>
            <div className="pub-tabelle" role="table">
              <div className="pub-tr pub-th" role="row">
                <span role="columnheader">{L.raum}</span>
                <span role="columnheader" title={L.positionen}>Pos.</span>
                <span role="columnheader">{L.io}</span>
                <span role="columnheader">{L.mangel}</span>
                <span role="columnheader" className="pub-hide-s">{L.nichtPruefbar}</span>
              </div>
              {m.raeume.map((r) => (
                <a key={r.id} className="pub-tr" role="row" href={`#raum-${r.id}`}>
                  <span role="cell">{r.name}</span>
                  <span role="cell">{r.zaehler.gesamt}</span>
                  <span role="cell">{r.zaehler.io}</span>
                  <span role="cell" className={r.zaehler.mangel ? "pub-rot" : ""}>{r.zaehler.mangel}</span>
                  <span role="cell" className="pub-hide-s">{r.zaehler.nichtPruefbar}</span>
                </a>
              ))}
            </div>
            <p className="pub-meta">{T.anzahlMaengel(m.maengel.length)}{m.maengel.length > 0 ? ` · ${offene} ${T.offen}` : ""}</p>
          </section>

          {/* 2. Mängel zuerst */}
          <section className="pub-sek" aria-labelledby="pub-maengel">
            <h2 id="pub-maengel" className="pub-h2 is-rot"><span>2</span> {L.maengelliste}</h2>
            {m.maengel.length === 0 && <p className="pub-meta">{L.keineMaengel}</p>}
            {m.maengel.map((x) => <MangelKarte key={x.nr} x={x} L={L} T={T} sprache={m.sprache} />)}
          </section>

          {/* 3. Räume */}
          {m.raeume.map((r, i) => <RaumBlock key={r.id} r={r} nr={i + 3} L={L} T={T} sprache={m.sprache} />)}

          {/* Schluss */}
          <section className="pub-sek" aria-labelledby="pub-schluss">
            <h2 id="pub-schluss" className="pub-h2"><span>{m.raeume.length + 3}</span> {L.schluss}</h2>
            {m.bemerkung && (<><p className="pub-caps">{L.gesamtbemerkung}</p><p className="pub-text">{m.bemerkung}</p></>)}
            <div className="pub-sigs">
              {m.schluss.map((s) => <Signatur key={s.titel} s={s} titel={s.titel === "kunde" ? L.kundeRolle : L.mitarbeiterRolle} L={L} sprache={m.sprache} />)}
            </div>
          </section>
        </main>

        <footer className="pub-fuss">
          <div className="pub-wrap">
            {m.hatPdf && <a className="pub-btn pub-btn-zweit" href={`/p/${token}/pdf`} rel="nofollow">{T.pdf}</a>}
            <p>{T.fuss}</p>
            <p className="pub-meta">{T.fussHinweis}</p>
          </div>
        </footer>
      </FotoGalerie>
    </div>
  );
}

function Chip({ status, L }: { status: keyof L["status"]; L: L }) {
  return <span className={`pub-chip is-${status}`}>{L.status[status]}</span>;
}

function FotoRaster({ fotos, art, T }: { fotos: PublicFoto[]; art: "maengel" | "objekt"; T: P }) {
  if (!fotos.length) return null;
  return (
    <ul className="pub-raster">
      {fotos.map((f) => (
        <li key={f.id}>
          {f.original ? (
            <a href={f.original} data-gal={art} data-pswp-width={f.breite || 1600} data-pswp-height={f.hoehe || 1200} data-caption={f.caption} aria-label={`${T.foto}: ${f.caption}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.vorschau ?? f.original} alt={f.caption} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </a>
          ) : (
            <span className="pub-foto-fehlt">{T.keineFotos}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MangelKarte({ x, L, T, sprache }: { x: PublicMangel; L: L; T: P; sprache: "de" | "en" }) {
  return (
    <article className={`pub-mangel${x.erledigt ? " is-erledigt" : ""}`}>
      <header>
        <strong className="pub-mangel-nr">{x.nr}</strong>
        <span className="pub-mangel-ort">{[x.raum, x.position].filter(Boolean).join(" · ")}</span>
        <span className={`pub-chip ${x.erledigt ? "is-io" : "is-mangel"}`}>{x.erledigt ? T.erledigt : L.status.mangel}</span>
      </header>
      <p className="pub-text">{x.text}</p>
      {x.frist && <p className="pub-meta">{T.fristBis}: {formatDatum(x.frist, sprache)}</p>}
      <FotoRaster fotos={x.fotos} art="maengel" T={T} />
    </article>
  );
}

function PositionBlock({ p, L, T }: { p: PublicPosition; L: L; T: P }) {
  return (
    <article className="pub-pos">
      <header>
        <span className="pub-pos-nr">{p.nr}</span>
        <h4>{p.titel}</h4>
        <Chip status={p.status} L={L} />
      </header>
      {(p.menge || p.einheit) && <p className="pub-meta">{L.menge}: {[p.menge, p.einheit].filter(Boolean).join(" ")}</p>}
      {p.langtext && <p className="pub-lang">{p.langtext}</p>}
      {p.pruefpunkte.length > 0 && (
        <ul className="pub-pp">
          {p.pruefpunkte.map((k, i) => (
            <li key={i}><span>{k.text}</span><Chip status={k.status} L={L} /></li>
          ))}
        </ul>
      )}
      {p.bemerkung && <p className="pub-text"><em>{L.bemerkung}:</em> {p.bemerkung}</p>}
      <FotoRaster fotos={p.fotos} art="objekt" T={T} />
    </article>
  );
}

function Signatur({ s, titel, L, sprache }: { s: PublicSignatur; titel: string; L: L; sprache: "de" | "en" }) {
  return (
    <figure className="pub-sig">
      {s.bild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.bild} alt={`${L.unterschrift}: ${s.name}`} referrerPolicy="no-referrer" />
      ) : (
        <div className="pub-sig-leer" />
      )}
      <figcaption>
        <span className="pub-caps">{titel}</span>
        <span>{s.name}{s.rolle ? ` (${s.rolle})` : ""}</span>
        <span className="pub-meta">{formatDatumZeit(s.zeitpunkt, sprache)}</span>
      </figcaption>
    </figure>
  );
}

function RaumBlock({ r, nr, L, T, sprache }: { r: PublicRaum; nr: number; L: L; T: P; sprache: "de" | "en" }) {
  return (
    <section className="pub-sek" id={`raum-${r.id}`} aria-labelledby={`h-${r.id}`}>
      <h2 id={`h-${r.id}`} className="pub-h2"><span>{nr}</span> {r.name}{r.etage ? <small> · {r.etage}</small> : null}</h2>
      {r.material && (<><p className="pub-caps">{T.material}</p><p className="pub-text pub-lang">{r.material}</p></>)}
      {r.positionen.map((p) => <PositionBlock key={p.nr + p.titel} p={p} L={L} T={T} />)}
      {r.ausgeblendet.length > 0 && (
        <details className="pub-aus">
          <summary>{T.ausgeblendet} · {T.ausgeblendetAuf(r.ausgeblendet.length)}</summary>
          {r.ausgeblendet.map((p) => <PositionBlock key={p.nr + p.titel} p={p} L={L} T={T} />)}
        </details>
      )}
      {r.bemerkung && (<><p className="pub-caps">{L.bemerkung}</p><p className="pub-text">{r.bemerkung}</p></>)}
      {r.signaturen.map((s) => <Signatur key="raum" s={s} titel={`${L.unterschriftRaum}: ${r.name}`} L={L} sprache={sprache} />)}
    </section>
  );
}
