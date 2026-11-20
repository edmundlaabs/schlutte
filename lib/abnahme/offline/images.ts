/** Verkleinert ein Foto lokal auf höchstens maxPx (lange Kante) und liefert JPEG. EXIF-Ausrichtung wird übernommen. */
export async function komprimiereFoto(file: Blob, maxPx = 1600, qualitaet = 0.8): Promise<{ blob: Blob; breite: number; hoehe: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const breite = Math.round(bitmap.width * scale);
  const hoehe = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close?.();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto konnte nicht umgewandelt werden."))), "image/jpeg", qualitaet)
  );
  return { blob, breite, hoehe };
}
