/** Registriert den Service Worker nur für /abnahme/. Der Rest der Schlutte bleibt online-only. */
export async function registriereAbnahmeSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw-abnahme.js", { scope: "/abnahme/", updateViaCache: "none" });
  } catch (e) {
    console.error("Service Worker konnte nicht registriert werden:", e);
    return null;
  }
}

/** Bittet den Service Worker, die Begehungs-Shell samt aller geladenen Chunks vorzuhalten. */
export async function precacheShell(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const chunks = Array.from(
    new Set([
      ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).map((s) => s.src),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet][href]")).map((l) => l.href),
    ])
  ).filter((u) => u.includes("/_next/"));
  reg.active?.postMessage({ type: "PRECACHE", urls: ["/abnahme/begehung", ...chunks] });
}

export async function speicherStatus(): Promise<{ belegt: number; quota: number; persistent: boolean } | null> {
  if (!navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  const persistent = (await navigator.storage.persisted?.()) ?? false;
  return { belegt: est.usage ?? 0, quota: est.quota ?? 0, persistent };
}

export async function fordereDauerhaftenSpeicher(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
