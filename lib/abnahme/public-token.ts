/**
 * Token für den öffentlichen Protokoll-Link (/p/<token>).
 * Entsteht beim Abschluss auf dem Gerät (das PDF braucht den Link auch offline). 24 Zufallsbytes = 192 Bit,
 * base64url ohne Padding = 32 Zeichen. Der Server prüft Format und Eindeutigkeit.
 */

const FORMAT = /^[A-Za-z0-9_-]{32,64}$/;

export const istPublicToken = (t: unknown): t is string => typeof t === "string" && FORMAT.test(t);

/** Standard-Basis, falls NEXT_PUBLIC_PUBLIC_BASE_URL nicht gesetzt ist (nie localhost im PDF/QR). */
export const STANDARD_BASIS_URL = "https://schlutte.vercel.app";

export function erzeugePublicToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** `${basis}/p/<token>`; Basis ohne Schrägstrich am Ende. */
export function publicUrl(token: string, basis: string | undefined = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL): string {
  const b = (basis?.trim() || STANDARD_BASIS_URL).replace(/\/+$/, "");
  return `${b}/p/${token}`;
}
