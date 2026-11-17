"use client";

import { useEffect, useState } from "react";

/** Gerätevarianten für die Anleitung „Schlutte aufs Handy“. */
export type DeviceKind = "ios-safari" | "ios-other" | "android" | "desktop";

export const INSTALL_EVENT = "schlutte:open-install";
const HINT_KEY = "schlutte-install-hint-until";
const HINT_DAYS = 30;

/** Basis-URL der App: NEXT_PUBLIC_APP_URL, sonst die aktuelle Origin. Ohne Slash am Ende. */
export function appBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = env || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/+$/, "");
}

/** Adresse der Einrichtungsseite (Ziel des QR-Codes). */
export function installPageUrl(): string {
  return `${appBaseUrl()}/app`;
}

export function detectDevice(ua: string, platform = "", touchPoints = 0): DeviceKind {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
  if (ios) {
    // Chrome, Firefox, Edge, Opera, Google-App und In-App-Browser (Mail-Links aus WhatsApp, Facebook, …)
    const other = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|LinkedInApp|WhatsApp/i.test(ua);
    return other ? "ios-other" : "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function openInstallSheet() {
  window.dispatchEvent(new CustomEvent(INSTALL_EVENT));
}

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Gerät, Standalone-Status und (Android) das Installations-Ereignis des Browsers. Auf dem Server: device = null. */
export function useInstallEnv() {
  const [device, setDevice] = useState<DeviceKind | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDevice(detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints));
      setStandalone(isStandalone());
    });
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setStandalone(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return { device, standalone, prompt, clearPrompt: () => setPrompt(null) };
}

/** Wurde der Hinweis-Streifen in den letzten 30 Tagen weggeklickt? (localStorage kann fehlen → dann zeigen.) */
export function isHintDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(HINT_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function dismissHint() {
  try {
    localStorage.setItem(HINT_KEY, String(Date.now() + HINT_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    /* Speicher gesperrt: der Streifen kommt beim nächsten Laden wieder */
  }
}
