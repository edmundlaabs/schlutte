import { BegehungApp } from "@/components/abnahme/begehung/BegehungApp";

export const metadata = { title: "Begehung" };

/**
 * Bewusst ohne nutzerbezogene Props: Diese Seite wird vom Service Worker für die Offline-Nutzung
 * zwischengespeichert; alle Daten kommen clientseitig aus IndexedDB.
 */
export default function BegehungPage() {
  return <BegehungApp />;
}
