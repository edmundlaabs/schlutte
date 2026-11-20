"use client";

import { useEffect, useState } from "react";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import { LokaleListe } from "./LokaleListe";
import { Protokollansicht } from "./Protokollansicht";

/** Einstieg der Begehung: eine Client-Shell (offline aus dem Service-Worker-Cache), Daten aus IndexedDB. */
export function BegehungApp() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void registriereAbnahmeSw();
    const lesen = () => setId(new URLSearchParams(window.location.search).get("id"));
    lesen();
    window.addEventListener("popstate", lesen);
    return () => window.removeEventListener("popstate", lesen);
  }, []);
  if (id === undefined) return null;
  return id ? <Protokollansicht id={id} /> : <LokaleListe />;
}
