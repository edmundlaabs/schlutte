import Link from "next/link";

export const metadata = { title: "Warenbestand — Schlutte" };

/** Bisherige Warenbestand-App (läuft bis zur Übernahme in die Schlutte weiter). */
const ALT_URL = "https://warenbestand-werk-2.vercel.app/";

/** Platzhalter, bis der Warenbestand in die Schlutte portiert ist: Umzugshinweis mit Weiterleitung. */
export default function WarenbestandPage() {
  return (
    <div style={{ padding: "56px 24px 80px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
      <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--fg)", marginBottom: 28 }}>
        <span className="grb-eyebrow">Werkstatt und Lager</span>
        <h1 className="grb-h-h1" style={{ marginTop: 6, fontSize: 36, letterSpacing: "-0.02em" }}>
          Warenbestand zieht um
        </h1>
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--fg-muted)", margin: 0 }}>
        Der Warenbestand WERK 2 wird in die Schlutte übernommen und ist hier bald direkt nutzbar.
        Bis dahin läuft er wie gewohnt in der bisherigen App. Deine Bestände und Buchungen bleiben dort erhalten.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
        <a href={ALT_URL} className="grb-btn grb-btn-primary" rel="noopener noreferrer">
          Weiter zur bisherigen App
        </a>
        <Link href="/" className="grb-btn grb-btn-quiet">Zur Startseite</Link>
      </div>
    </div>
  );
}
