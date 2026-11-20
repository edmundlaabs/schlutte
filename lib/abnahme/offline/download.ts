/**
 * PDF auf das Gerät bringen, auch offline.
 * - iPad/iPhone (und wo verfügbar): Teilen-Menü → „In Dateien sichern“.
 * - Android/Desktop: normaler Download (Download-Ordner).
 */
export async function teileOderLadeHerunter(blob: Blob, dateiname: string): Promise<void> {
  const file = new File([blob], dateiname, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const istApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (istApple && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: dateiname });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
