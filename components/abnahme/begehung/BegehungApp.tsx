"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { registriereAbnahmeSw } from "@/lib/abnahme/offline/sw-register";
import { lokaleArt } from "@/lib/abnahme/offline/store";
import { LokaleListe } from "./LokaleListe";
import { Protokollansicht } from "./Protokollansicht";
import { RegieEditor } from "./RegieEditor";

/** Einstieg der Begehung: eine Client-Shell (offline aus dem Service-Worker-Cache), Daten aus IndexedDB. */
export function BegehungApp() {
  // Die Dokument-ID steht in der URL (?id=…). useSearchParams reagiert auch auf Navigation per Link
  // („Öffnen“ in der Liste, „Zur Liste“), die kein popstate-Ereignis auslöst.
  const id = useSearchParams().get("id");
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
  }, []);
  if (!id) return <LokaleListe />;
  if (!art) return null;
  return art === "regie" ? <RegieEditor key={id} id={id} /> : <Protokollansicht key={id} id={id} />;
}
