import type { PublicFoto, PublicModell, PublicPosition } from "./public-view.ts";

/** Nur für die lokale Entwicklung (NODE_ENV=development): Demo-Token statt Datenbank, zum Prüfen von Layout und Lightbox. */
export const DEMO_TOKEN = "DEMO_FIXTURE_DEMO_FIXTURE_DEMO__";

const bild = (i: number, b: number, h: number, label: string): string => {
  const hue = (i * 37) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${h}" viewBox="0 0 ${b} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,62%)"/><stop offset="1" stop-color="hsl(${hue + 30},30%,35%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g stroke="rgba(255,255,255,.35)" stroke-width="3"><path d="M0 0L${b} ${h}M${b} 0L0 ${h}"/></g><text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(h / 8)}" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export function demoModell(): PublicModell {
  const foto = (i: number, caption: string): PublicFoto => {
    const hoch = i % 3 === 0;
    const b = hoch ? 1200 : 1600;
    const h = hoch ? 1600 : 1200;
    return { id: `f${i}`, vorschau: bild(i, b / 4, h / 4, `${i}`), original: bild(i, b, h, `Foto ${i}`), breite: b, hoehe: h, caption };
  };
  const pos = (n: number, titel: string, mit: number): PublicPosition => ({
    nr: String(n), titel, menge: "1", einheit: "Stk", langtext: n === 1 ? "Korpus Eiche furniert, Fronten matt lackiert, Griffe Messing gebürstet." : "", bemerkung: "",
    status: n === 2 ? "mangel" : "io",
    pruefpunkte: [{ text: "Oberfläche", status: n === 2 ? "mangel" : "io" }, { text: "Funktion", status: "io" }],
    fotos: Array.from({ length: mit }, (_, k) => foto(n * 10 + k, `Küche · ${n} ${titel}`)),
  });
  const positionen = [pos(1, "Hochschrank", 6), pos(2, "Unterschrank Spüle", 4), pos(3, "Arbeitsplatte", 3), pos(4, "Wandboard", 2), pos(5, "Auszug", 2), pos(6, "Sockel", 1)];
  return {
    sprache: "de", version: 1, kommission: "250148", kunde: "Demo Kunde", projekt: "Küche EG", titel: "", ort: "Kandern",
    datum: "2026-11-27T10:00:00Z", mitarbeiter: "Max Muster", teilnehmer: [{ name: "Erika Demo", rolle: "Kunde" }], bemerkung: "Alles bis auf den genannten Mangel in Ordnung.",
    raeume: [{
      id: "r1", name: "Küche", etage: "EG", material: "Eiche furniert, Fronten matt", bemerkung: "",
      zaehler: { gesamt: 6, io: 5, mangel: 1, nichtPruefbar: 0, offen: 0 }, positionen, 
      ausgeblendet: [{ ...pos(7, "Mehrpreis Lieferung", 0), nr: "7", pruefpunkte: [], status: "io" }],
      signaturen: [{ name: "Erika Demo", rolle: "Kunde", zeitpunkt: "2026-11-27T09:50:00Z", bild: null, titel: "raum" }],
    }],
    maengel: [{
      nr: "M1", raum: "Küche", position: "2 Unterschrank Spüle", text: "Kratzer an der Front links, bitte nacharbeiten.", frist: "2026-12-15", erledigt: false,
      fotos: [foto(901, "M1.1 · Kratzer an der Front links"), foto(902, "M1.2 · Kratzer an der Front links")],
    }],
    schluss: [
      { name: "Erika Demo", rolle: "Kunde", zeitpunkt: "2026-11-27T10:00:00Z", bild: null, titel: "kunde" },
      { name: "Max Muster", rolle: "Mitarbeiter", zeitpunkt: "2026-11-27T10:01:00Z", bild: null, titel: "mitarbeiter" },
    ],
    hatPdf: false, objektFotoAnzahl: 18, maengelFotoAnzahl: 2,
  };
}
