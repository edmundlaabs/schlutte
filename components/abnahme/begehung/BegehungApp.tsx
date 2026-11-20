"use client";

import { useEffect, useState } from "react";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import { lokaleArt } from "@/lib/abnahme/offline/store";
import { LokaleListe } from "./LokaleListe";
import { Protokollansicht } from "./Protokollansicht";
import { RegieEditor } from "./RegieEditor";

/** Einstieg der Begehung: eine Client-Shell (offline aus dem Service-Worker-Cache), Daten aus IndexedDB. */
export function BegehungApp() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [art, setArt] = useState<"abnahme" | "regie" | null>(null);
  useEffect(() => {
    if (!id) return;
    let aktiv = true;
    void lokaleArt(id).then((a) => aktiv && setArt(a ?? "abnahme"));
    return () => {
      aktiv = false;
    };
  }, [id]);
  useEffect(() => {
    void registriereAbnahmeSw();
    const lesen = () => setId(new URLSearchParams(window.location.search).get("id"));
    lesen();
    window.addEventListener("popstate", lesen);
    return () => window.removeEventListener("popstate", lesen);
  }, []);
  if (id === undefined) return null;
  if (!id) return <LokaleListe />;
  if (!art) return null;
  return art === "regie" ? <RegieEditor id={id} /> : <Protokollansicht id={id} />;
}
