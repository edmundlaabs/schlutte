/** Kurzname des Kunden für Dateinamen: nur ASCII, erster Name, höchstens 20 Zeichen. */
export function kundeKurz(kunde: string): string {
  const ascii = kunde
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Erster Namensteil vor „&“, „/“, „-“ (Zusatz), „,“ oder „ und “
  const first = ascii.split(/\s*(?:&|\/|,|\s-\s|\bund\b)\s*/i)[0] ?? ascii;
  const words = first.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/)
    .filter((w) => w && !/^(gmbh|ag|kg|ug|ohg|gbr|co|mbh|sa|sarl)$/i.test(w));
  // Bei „Vorname Nachname“ ist der Nachname (letztes Wort) das Kennzeichnende.
  const short = (words.length > 1 ? words[words.length - 1] : words[0]) ?? "Kunde";
  return short.slice(0, 20);
}

function datumISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function abnahmeDateiname(kommission: string, kunde: string, datum: Date | string = new Date()): string {
  const d = typeof datum === "string" ? datum.slice(0, 10) : datumISO(datum);
  return `Abnahme_${kommission.trim()}_${kundeKurz(kunde)}_${d}.pdf`;
}

export function regieDateiname(kommission: string, kunde: string, datum: Date | string = new Date()): string {
  const d = typeof datum === "string" ? datum.slice(0, 10) : datumISO(datum);
  return `Regiebericht_${kommission.trim()}_${kundeKurz(kunde)}_${d}.pdf`;
}
