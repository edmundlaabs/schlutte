"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { installPageUrl, type DeviceKind, type InstallPrompt } from "@/lib/install";

/** Link in die Zwischenablage; ohne Berechtigung öffnet sich der Link zum Markieren. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      window.prompt("Link kopieren:", text);
    } catch {
      /* nichts */
    }
    return false;
  }
}

function CopyLink({ label = "Link kopieren" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="install-btn install-btn-quiet"
      onClick={async () => {
        if (await copyText(installPageUrl())) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        }
      }}
    >
      {copied ? "Link kopiert" : label}
    </button>
  );
}

function IosSteps() {
  return (
    <>
      <ol className="install-steps">
        <li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil)</li>
        <li>Nach unten scrollen, <b>Zum Home-Bildschirm</b> wählen</li>
        <li><b>Hinzufügen</b> tippen</li>
      </ol>
      <p className="install-note">Danach Schlutte vom Home-Bildschirm starten und einmal anmelden.</p>
    </>
  );
}

function Qr() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(installPageUrl(), {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1d1d1b", light: "#fbf9f4" },
    })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(""));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="install-qr">
      {/* Data-URL wird lokal erzeugt; Next-Image brächte hier keinen Vorteil. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="QR-Code zur Einrichtungsseite von Schlutte" /> : <span>QR-Code wird geladen …</span>}
    </div>
  );
}

/** Gerätespezifische Anleitung (Sheet und Seite /app). `device` = null: noch unbekannt (Server/erster Render). */
export function InstallGuide({
  device,
  prompt,
  onInstalled,
}: {
  device: DeviceKind | null;
  prompt?: InstallPrompt | null;
  onInstalled?: () => void;
}) {
  if (!device) return <div className="install-guide" aria-busy="true" />;

  if (device === "ios-safari") {
    return (
      <div className="install-guide">
        <IosSteps />
      </div>
    );
  }

  if (device === "ios-other") {
    return (
      <div className="install-guide">
        <p className="install-lead">
          Die Installation klappt am zuverlässigsten in <b>Safari</b>. Link kopieren, in Safari einfügen und dort zum Home-Bildschirm hinzufügen.
        </p>
        <CopyLink />
        <IosSteps />
      </div>
    );
  }

  if (device === "android") {
    return (
      <div className="install-guide">
        {prompt && (
          <button
            type="button"
            className="install-btn install-btn-primary"
            onClick={async () => {
              await prompt.prompt();
              const result = await prompt.userChoice;
              if (result.outcome === "accepted") onInstalled?.();
            }}
          >
            App installieren
          </button>
        )}
        <p className="install-lead">
          Auf <b>App installieren</b> tippen. Falls der Button fehlt: oben rechts <b>⋮</b> → <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="install-guide">
      <p className="install-lead">
        Mit der Handykamera scannen. Der Link öffnet Schlutte auf dem Handy, dort dann wie angezeigt zum Home-Bildschirm hinzufügen.
      </p>
      <Qr />
      <CopyLink />
    </div>
  );
}
