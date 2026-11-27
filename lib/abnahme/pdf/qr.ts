/** QR-Code als PNG (ohne eigenen Rand; die Ruhezone legt das PDF-Layout fest). Läuft offline im Browser und in Node. */
export async function erzeugeQrPng(url: string): Promise<Uint8Array> {
  const QRCode = (await import("qrcode")).default;
  const dataUrl = await QRCode.toDataURL(url, { margin: 0, width: 600, errorCorrectionLevel: "M", color: { dark: "#0E0E0D", light: "#FFFFFF" } });
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
