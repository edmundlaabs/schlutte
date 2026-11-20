# Modul Abnahme (`/abnahme`)

Abnahmeprotokoll und Regiebericht für die Baustelle: Tablet-Begehung auch ohne Internet, Unterschriften, PDF, Ablage, Versand.

## Einrichtung (einmalig)

1. **Migration** `supabase/migrations/20261120_abnahme.sql` im Supabase SQL-Editor ausführen (vorher Backup nach `../Backup/…`). Sie legt die Tabellen `abnahme_*`, RLS, Sperr-Trigger, die Checkout-Funktionen, den privaten Storage-Bucket `abnahme` und die Startvorlagen an.
2. **Zugang**: unter *Admin → Zugänge* den Haken „Abnahme“ pro Mitarbeiter setzen (CEO/Admin haben immer Zugriff). Bestehende Mitarbeiter bekommen ihn nicht automatisch.
3. **Mailversand (Resend)**, nur als Umgebungsvariablen (nie im Code):
   | Variable | Bedeutung |
   |---|---|
   | `RESEND_API_KEY` | API-Key von resend.com |
   | `MAIL_FROM` | Absender, z. B. `Grabner Design <abnahme@deine-domain.de>` (Domain bei Resend verifiziert) |
   | `MAIL_COPY_TO` | optional: interne Kopie (BCC), mehrere durch Komma |
   Ohne Konfiguration wird nichts verschickt; der Versand steht dann als „Fehler: nicht konfiguriert“ im Versandprotokoll und bleibt bei Offline-Vormerkungen erhalten.
4. Tablets: Schlutte auf den **Home-Bildschirm** legen (iPad Safari → Teilen → „Zum Home-Bildschirm“; Android Chrome → App installieren). Nur so behält iOS die lokalen Daten länger als 7 Tage.

## Ablauf

1. **Import (Werkstatt, online)** `/abnahme/import`: Profacto-PDF „Einfache Positionsliste“ wählen. Das PDF wird im Browser gelesen (pdf.js). Prüfansicht: Kommission und Kunde (Pflicht; Kunde editierbar, Profacto schneidet ab), Projekt, Ort, Sprache, Räume/Positionen verschieben (Auswahl → „Verschieben nach …“), Räume umbenennen/neu/Etage, ausgeblendete Positionen einblenden und aufnehmen, Prüfpunkt-Vorlage je Position. Kommission wird über die Nummer mit `commissions` verknüpft; fehlt sie, wird sie auf Wunsch angelegt. Original-PDF wird im Storage abgelegt. Eigene Positionen lassen sich schon hier je Raum hinzufügen. Nach dem Anlegen wird das Protokoll standardmäßig **automatisch auf diesem Gerät offline gespeichert** (ausgecheckt, Daten und App-Shell im Cache); abwählbar, wenn ein anderes Tablet die Begehung macht.
2. **Für Baustelle laden** `/abnahme/begehung` (Tablet, online): Protokoll wird für dieses Gerät ausgecheckt und komplett in IndexedDB gespeichert.
3. **Begehung (offline möglich)**: Übersicht mit Fortschritt je Raum → eine Seite je Raum (Weiterklicken oder nach links/rechts wischen). Pro Position/Prüfpunkt i. O. / Mangel / nicht prüfbar. Mangel: Bemerkung Pflicht, Fotos (Kamera, lokal auf max. 1600 px komprimiert), optional Frist. „Alle Positionen im Raum i. O.“ mit einem Tipp; mehrere Positionen auswählen und gemeinsam setzen. Unterschrift je Raum, Mangel-Positionen zusätzlich. Freie Bemerkungen je Raum und gesamt. **Eigene Positionen und Prüfpunkte** lassen sich jederzeit nachträglich hinzufügen (auch offline): „+ Eigene Position hinzufügen“ im Raum (mit Vorlage und/oder freien Prüfpunkten), „Prüfpunkt hinzufügen“ an jeder Position; selbst angelegte Positionen (Nr. N1, N2 …) und alle Prüfpunkte sind wieder entfernbar.
4. **Abschluss**: Teilnehmer, Ort, Datum/Uhrzeit automatisch, Schlussunterschrift Kunde und Mitarbeiter (angemeldeter Nutzer). Das PDF wird lokal erzeugt, danach ist das Protokoll gesperrt. Kunden-E-Mail angegeben → automatischer Versand nach dem Sync.
5. **Sync**: automatisch, sobald Internet da ist (Ereignis „online“, App sichtbar, alle 30 s). Status je Protokoll: „lokal gespeichert“ / „synchronisiert“ / „Sync-Fehler“.
6. **Ablage** `/abnahme` (PC/Tablet): Suche und Filter (Kommission, Kunde, Typ, Status, Mitarbeiter, Datum), offene Mängel markiert, PDF-Download, Versand/Erneut senden, Versandprotokoll.
7. **Nachtrag**: im Protokoll offene Mängel als erledigt wählen → neue Version (die alte bleibt unverändert). Der Nachtrag wird wieder auf dem Tablet geladen, unterschrieben und abgeschlossen.
8. **Regiebericht**: `/abnahme/begehung` → „Neuer Regiebericht“ (Kommission und Kunde Pflicht, Kopf vorbefüllt aus Kommission/letztem Dokument). Zeilen mit Datum, Beschreibung, Menge, Länge, Breite, Stärke, km, Stunden je Rolle (Meister, Monteur, Lehrling, Helfer; 0,5er-Schritte), Summen, „anerkannt, den …“ + Kundenunterschrift. Gleiche Technik: offline, Sync, PDF (A4 quer, DE/EN), Ablage, Versand.

PDF-Dateinamen: `Abnahme_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`, `Regiebericht_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`.

## Technik

- **Parser** `lib/abnahme/parser/`: `pdf-text.ts` liest Textstücke mit Position und Schrift (pdfjs-dist), `profacto.ts` ordnet sie. Regeln: Seitenkopf ignorieren (Grundlinie < 95 pt); Kopf Seite 1 dreispaltig (Kommission x < 80, Projekt x < 260, Kunde x ≥ 260); Positionszeile = Ganzzahl bei x < 80; Menge x ≈ 95, Einheit x ≈ 146; Titel = fette Textstücke bzw. alles hinter dem „/“; Folgezeilen = Langtext (auch über Seitenumbruch). Ohne Menge = Raum. Ausgeblendet: Artikel `Z_…`, „Mehrpreis“, „Minderpreis“, „Krankosten“. Doppelte/fehlende Nr. werden nicht abgewiesen, sondern gewarnt. Test mit der Beispiel-PDF: `lib/abnahme/parser/profacto.test.ts` (liegt bewusst nur lokal in `__fixtures__/`, in `.gitignore`; ohne Datei werden die Tests übersprungen).
- **Dokumentmodell** `lib/abnahme/types.ts`, DB-Abbildung `mapping.ts`, Fachlogik `logic.ts` (rein, getestet).
- **Offline**: `public/sw-abnahme.js` (Scope `/abnahme/`, Header `Service-Worker-Allowed` in `next.config.ts`). Cache der Begehungs-Shell `/abnahme/begehung` (network-first, 3 s), `_next/static`, Schriften, Logo cache-first. Alles andere unberührt, die übrige Schlutte bleibt online-only. Alle Begehungs- und Regie-Ansichten laufen in dieser einen Client-Seite (Navigation per URL-Hash), damit offline kein Next-Routing nötig ist. Daten in IndexedDB (`schlutte-abnahme`: `docs`, `blobs`, `meta`), jede Eingabe wird sofort geschrieben. Die Shell-Seite enthält keine nutzerbezogenen Daten.
- **Sync** `lib/abnahme/offline/sync.ts` + `/api/abnahme/sync`: erst Fotos/Unterschriften/PDF in den Storage, dann ein JSON-Upsert (Reihenfolge Protokoll → Kinder → bei Abschluss zuletzt der Statuswechsel). Client-UUIDs machen es idempotent. Konflikte: ein Dokument ist nur auf **einem Gerät** ausgecheckt (`abnahme_checkout`), Versionsprüfung über `rev`. CEO/Admin können ein Gerät freigeben (Ablage-Detailseite).
- **PDF** `lib/abnahme/pdf/` (pdf-lib, Plex Sans, Farben aus tokens.css): läuft im Browser, also auch offline. Inhalt: Kopf, Gesamtübersicht, je Raum Materialangaben + Positionen + Prüfpunkte + Status + Langtexte, Mängelliste mit Fotos, Unterschriften, Schluss, Anhang „nicht Gegenstand der Abnahme“, Fuß „Seite x von y“. DE/EN über `lib/abnahme/i18n.ts`.
- **Mail** `lib/mail/send.ts` (Resend per `fetch`), Versandlogik `lib/abnahme/versand-server.ts`. Offline ausgelöst = Vormerkung in IndexedDB, nach dem Sync verschickt.

## iPad / Android: Speicher und Grenzen

- iOS Safari löscht Website-Daten nach 7 Tagen ohne Nutzung, **nicht** bei installierter Home-Bildschirm-App. Die Begehungsliste zeigt Speicherbelegung und ob dauerhafter Speicher bestätigt ist (`navigator.storage.persist()`).
- Eine Begehung braucht grob 20–30 MB (Fotos ≈ 0,3–0,5 MB). Ungesyncte Daten gehen verloren, wenn die Browserdaten gelöscht werden: deshalb Statusanzeige „lokal gespeichert“ und Sync-Knopf.
- iOS kennt kein Background Sync: der Sync läuft, wenn die App offen ist.
- Abgelaufene Anmeldung: Die Begehung bleibt nutzbar; der Sync verlangt eine gültige Sitzung („Bitte erneut anmelden“), danach geht es weiter.
- Ein Tablet-Wechsel mitten im Protokoll: erst „Vom Gerät entfernen“ (synchronisiert und gibt frei) oder Admin-Freigabe.
- Beim Abmelden bleiben lokale Daten und der Shell-Cache auf dem Gerät. Tablets nur für Mitarbeiter verwenden.

## Tests

`npm test` (Parser, Fachlogik, Dateinamen, PDF-Vollständigkeit, Nachtrag, Regiebericht). Die Parser- und PDF-Tests gegen die echte Profacto-Datei laufen nur, wenn `lib/abnahme/parser/__fixtures__/Ang0--1731724496.pdf` vorhanden ist.
