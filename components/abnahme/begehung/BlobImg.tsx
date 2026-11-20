"use client";

import { useEffect, useState } from "react";
import { holeBlob } from "@/lib/abnahme/offline/db";

/** Zeigt ein lokal gespeichertes Bild (Foto/Unterschrift) aus IndexedDB. */
export function BlobImg({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    let objectUrl: string | null = null;
    holeBlob(id).then((b) => {
      if (!aktiv || !b) return;
      objectUrl = URL.createObjectURL(b.blob);
      setUrl(objectUrl);
    });
    return () => {
      aktiv = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className={className} /> : <span className="abn-img-ph" aria-label={alt} />;
}
