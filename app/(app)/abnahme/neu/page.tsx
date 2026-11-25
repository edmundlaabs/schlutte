import Link from "next/link";

export const metadata = { title: "Neues Protokoll" };

export default function NeuesProtokollPage() {
  return (
    <>
      <header className="aus-head">
        <span className="aus-eyebrow">Abnahme</span>
        <h1 className="aus-h1">Neues Protokoll</h1>
        <p className="aus-lede">
          Ein Abnahmeprotokoll entsteht aus einer Profacto-Positionsliste oder komplett von Hand, wahlweise aus einer
          Protokoll-Vorlage. Das Anlegen braucht Internet; danach lässt sich das Protokoll auf dem Tablet offline begehen.
        </p>
      </header>
      <div className="abn-wege">
        <Link className="abn-weg-karte" href="/abnahme/import">
          <span className="abn-weg-titel">Aus Profacto-PDF</span>
          <span className="abn-weg-text">
            Positionsliste „Einfache Positionsliste“ hochladen, Räume und Prüfpunkte prüfen, Kunde und Kommission wählen.
          </span>
          <span className="abn-weg-go">PDF importieren →</span>
        </Link>
        <Link className="abn-weg-karte" href="/abnahme/neu/manuell">
          <span className="abn-weg-titel">Manuell / aus Vorlage</span>
          <span className="abn-weg-text">
            Kunde und Kommission wählen (oder ohne Kommission), Räume, Positionen und Prüfpunkte selbst eingeben oder
            eine Protokoll-Vorlage einfügen.
          </span>
          <span className="abn-weg-go">Protokoll erfassen →</span>
        </Link>
      </div>
    </>
  );
}
