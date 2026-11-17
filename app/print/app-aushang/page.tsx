import { headers } from "next/headers";
import QRCode from "qrcode";
import { PrintToolbar } from "@/components/print/PrintToolbar";

export const metadata = { title: "Aushang: Schlutte aufs Handy" };
export const dynamic = "force-dynamic";

/** Basis-URL für den QR-Code: NEXT_PUBLIC_APP_URL, sonst die Adresse dieser Anfrage. */
async function baseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Druckbarer Aushang (A4 hoch): QR-Code zur Einrichtungsseite, die drei iPhone-Schritte, Android in Kurzform. */
export default async function AppAushangPage() {
  const url = `${await baseUrl()}/app`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0e0e0d", light: "#ffffff" },
  });

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .aushang { --print-w: 210mm; --print-h: 297mm; width: 210mm; min-height: 297mm; padding: 20mm 22mm; background: #fff; color: #0e0e0d; display: flex; flex-direction: column; gap: 10mm; font-family: var(--font-sans); color-scheme: light; box-shadow: 0 30px 80px -30px rgba(14,14,13,.45); }
        .aushang-logo { height: 11mm; width: auto; align-self: flex-start; }
        .aushang h1 { margin: 0; font-family: var(--font-display); font-weight: 300; font-size: 44pt; line-height: 1.02; letter-spacing: -0.02em; }
        .aushang-rule { height: 0; border-top: 0.4mm solid #0e0e0d; }
        .aushang-qr { width: 110mm; height: 110mm; align-self: center; }
        .aushang-qr svg { width: 100%; height: 100%; display: block; }
        .aushang-url { align-self: center; font-family: var(--font-mono); font-size: 11pt; letter-spacing: 0.06em; }
        .aushang h2 { margin: 0 0 3mm; font-family: var(--font-mono); font-size: 9pt; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 500; }
        .aushang ol { margin: 0; padding-left: 7mm; font-size: 15pt; line-height: 1.55; }
        .aushang p { margin: 0; font-size: 13pt; line-height: 1.5; max-width: none; }
        .aushang b { font-weight: 600; }
        .aushang-foot { margin-top: auto; font-family: var(--font-mono); font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #5c5852; }
        @media print { .aushang { box-shadow: none; width: 210mm; height: 297mm; max-height: 297mm; overflow: hidden; } }
      `}</style>
      <PrintToolbar backUrl="/admin/mitarbeiter" />
      <div className="aushang">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/grabner-schlutte-logo.svg" alt="Grabner Schlutte" className="aushang-logo" />
        <h1>Schlutte aufs Handy</h1>
        <div className="aushang-rule" />
        <div className="aushang-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="aushang-url">{url.replace(/^https?:\/\//, "")}</div>
        <section>
          <h2>iPhone (Safari)</h2>
          <ol>
            <li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil)</li>
            <li>Nach unten scrollen, <b>Zum Home-Bildschirm</b> wählen</li>
            <li><b>Hinzufügen</b> tippen</li>
          </ol>
        </section>
        <section>
          <h2>Android</h2>
          <p>Auf <b>App installieren</b> tippen. Falls der Button fehlt: oben rechts <b>⋮</b> → <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.</p>
        </section>
        <div className="aushang-foot">Danach Schlutte vom Home-Bildschirm starten und einmal anmelden.</div>
      </div>
    </>
  );
}
