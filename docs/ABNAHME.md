# Modul Abnahme (`/abnahme`)

Abnahmeprotokoll und Regiebericht für die Baustelle: Tablet-Begehung auch ohne Internet, Unterschriften, PDF, Ablage, Versand.

## Einrichtung (einmalig)

1. **Migration** `supabase/migrations/20261120_abnahme.sql` im Supabase SQL-Editor ausführen (vorher Backup nach `../Backup/…`). Sie legt die Tabellen `abnahme_*`, RLS, Sperr-Trigger, die Checkout-Funktionen, den privaten Storage-Bucket `abnahme` und die Startvorlagen an. Danach (ab 1.3.0) `20261126_abnahme_abgleich.sql` (Archiv der Stände für den Abgleich). Zuvor (ab 1.2.0) `20261125_abnahme_manuell.sql`: Protokolle ohne Kommission, Herkunft `quelle`, Protokoll-Vorlagen (zwei Startvorlagen).
2. **Zugang**: unter *Admin → Zugänge* den Haken „Abnahme“ pro Mitarbeiter setzen (CEO/Admin haben immer Zugriff). Bestehende Mitarbeiter bekommen ihn nicht automatisch.
3. **Mailversand (Resend)**, nur als Umgebungsvariablen (nie im Code):
   | Variable | Bedeutung |
   |---|---|
   | `RESEND_API_KEY` | API-Key von resend.com |
   | `MAIL_FROM` | Absender, z. B. `Grabner Design <abnahme@deine-domain.de>` (Domain bei Resend verifiziert) |
   | `MAIL_COPY_TO` | optional: interne Kopie (BCC), mehrere durch Komma |
   Ohne Konfiguration wird nichts verschickt; der Versand steht dann als „Fehler: nicht konfiguriert“ im Versandprotokoll und bleibt bei Offline-Vormerkungen erhalten.
4. Tablets: Schlutte auf den **Home-Bildschirm** legen (iPad Safari → Teilen → „Zum Home-Bildschirm“; Android Chrome → App installieren). Nur so behält iOS die lokalen Daten länger als 7 Tage.

## Neues Protokoll (ab 1.2.0)

`/abnahme/neu` bietet zwei Wege: **Aus Profacto-PDF** (`/abnahme/import`) und **Manuell / aus Vorlage** (`/abnahme/neu/manuell`). Anlegen braucht Internet; danach optional gleich offline auf dem Gerät speichern.

- **Kunde und Kommission** (gemeinsame Komponente `KundeKommissionAuswahl`, in Import und Editor): *Bestehende suchen* (Typeahead über Kommissionsnummer, Kunde, Projekt; Auswahl übernimmt Nummer, Kunde, Projekt; Kunde bleibt editierbar), *Neu anlegen* (6 Ziffern, Duplikatprüfung; die Kommission entsteht erst beim Speichern des Protokolls) oder *Ohne Kommission* (Kleinauftrag, nur Kunde Pflicht, keine Zeile in `commissions`). Im Import wird die Nummer aus der PDF gesucht (gefunden = bestehend, sonst „neu“ vorbelegt).
- **Manueller Editor**: Kopf (Kunde/Kommission, Ort, Bezeichnung, Sprache, Kunden-E-Mail), Räume (anlegen, umbenennen, Etage, Material, Reihenfolge, löschen), Positionen je Raum (Nr. fortlaufend und änderbar, Titel Pflicht, Menge, Einheit, Beschreibung, Möbeltyp-Vorlage → Prüfpunkte), Prüfpunkte umbenennen/löschen/ergänzen, Positionen zwischen Räumen verschieben. Eingaben werden bis zum Anlegen in localStorage zwischengespeichert (Banner „Entwurf wiederherstellen“, „Verwerfen“).
- **Protokoll-Vorlagen** (`/abnahme/vorlagen?bereich=protokoll`, CEO/Admin): komplette Sets aus Räumen, Positionen (mit Möbeltyp-Verweis und/oder eigenen Prüfpunkten). Im Editor „Aus Vorlage einfügen“ (mehrfach möglich, gleichnamige Räume werden zusammengeführt, neue IDs, Status offen; fehlt/inaktiv die Möbeltyp-Vorlage: Hinweis). „Als Vorlage speichern“ übernimmt nur die Struktur.
- **Ohne Kommission** durchgängig: Anzeige „ohne Kommission“, Ablage-Filter „Nur ohne Kommission“, PDF-Kopf und -Fuß, Dateiname `Abnahme_ohne-Kommission_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`, Versand-Text ohne Kommissionsteil, Sync (nur Kunde Pflicht). Eine Kommission lässt sich auf der Protokollseite nachträglich zuordnen (nicht abgeschlossen, nicht ausgecheckt).
- Herkunft `quelle` (`profacto` / `manuell` / `vorlage`) steht am Protokoll und auf der Detailseite. Ohne Original-PDF entfällt „Original-Positionsliste“; der PDF-Anhang „nicht Gegenstand der Abnahme“ erscheint nur bei ausgeblendeten Positionen.

## Ablauf

1. **Import (Werkstatt, online)** `/abnahme/import`: Profacto-PDF „Einfache Positionsliste“ wählen. Das PDF wird im Browser gelesen (pdf.js). Prüfansicht: Kommission und Kunde (Pflicht; Kunde editierbar, Profacto schneidet ab), Projekt, Ort, Sprache, Räume/Positionen verschieben (Auswahl → „Verschieben nach …“), Räume umbenennen/neu/Etage, ausgeblendete Positionen einblenden und aufnehmen, Prüfpunkt-Vorlage je Position. Kommission wird über die Nummer mit `commissions` verknüpft; fehlt sie, wird sie auf Wunsch angelegt. Original-PDF wird im Storage abgelegt. Eigene Positionen lassen sich schon hier je Raum hinzufügen. Nach dem Anlegen wird das Protokoll standardmäßig **automatisch auf diesem Gerät offline gespeichert** (ausgecheckt, Daten und App-Shell im Cache); abwählbar, wenn ein anderes Tablet die Begehung macht.
2. **Für Baustelle laden** `/abnahme/begehung` (Tablet, online): Protokoll wird für dieses Gerät ausgecheckt und komplett in IndexedDB gespeichert.
3. **Begehung (offline möglich)**: Übersicht mit Fortschritt je Raum → eine Seite je Raum (Weiterklicken oder nach links/rechts wischen). Pro Position/Prüfpunkt i. O. / Mangel / nicht prüfbar. Mangel: Bemerkung Pflicht, Fotos (Kamera, lokal auf max. 1600 px komprimiert), optional Frist. „Alle Positionen im Raum i. O.“ mit einem Tipp; mehrere Positionen auswählen und gemeinsam setzen. Unterschrift je Raum, Mangel-Positionen zusätzlich. Freie Bemerkungen je Raum und gesamt. **Eigene Positionen und Prüfpunkte** lassen sich jederzeit nachträglich hinzufügen (auch offline): „+ Eigene Position hinzufügen“ im Raum (mit Vorlage und/oder freien Prüfpunkten), „Prüfpunkt hinzufügen“ an jeder Position; selbst angelegte Positionen (Nr. N1, N2 …) und alle Prüfpunkte sind wieder entfernbar.
4. **Abschluss**: Teilnehmer, Ort, Datum/Uhrzeit automatisch, Schlussunterschrift Kunde und Mitarbeiter (angemeldeter Nutzer). Das PDF wird lokal erzeugt, danach ist das Protokoll gesperrt. Kunden-E-Mail angegeben → automatischer Versand nach dem Sync.
5. **Sync und Abgleich (ab 1.3.0, kein Auschecken mehr bei Protokollen)**: Mehrere Geräte und das Büro dürfen dasselbe Protokoll bearbeiten. Jedes Gerät merkt sich den letzten gemeinsamen Stand (`basis`) und die Server-Version (`rev`). Beim Sync prüft der Server die Version: stimmt sie, wird gespeichert wie bisher. Weicht sie ab (z. B. anderes Tablet oder Büro hat zwischenzeitlich geändert, auch Mitarbeiter-/Kommissionswechsel auf der Protokollseite), wird nichts überschrieben; das Protokoll zeigt „Abgleich nötig“ und den Knopf **Abgleichen**. Der Dialog listet alle Unterschiede (Kopf, Räume, Positionen, Prüfpunkte, Mängel, Fotos, Unterschriften) und wer geändert hat (dieses Gerät / Server / beide = Konflikt). Je Eintrag wählst du „Dieses Gerät“ oder „Server“; angezeigt wird, ob dabei hinzugefügt, ersetzt oder gelöscht wird. Änderungen an verschiedenen Stellen sind vorausgewählt, bei Konflikten gilt vorab der Stand dieses Geräts. Danach werden **beide Stände archiviert** (Tabelle `abnahme_staende`, auf der Protokollseite „Frühere Stände“, JSON-Download) und das Ergebnis gespeichert. Ein auf dem Gerät schon abgeschlossenes Protokoll lässt sich nur als Ganzes übernehmen (das PDF ist aus diesem Stand entstanden). Der Regiebericht hat weiterhin den Checkout.
5a. **Sync**: automatisch, sobald Internet da ist (Ereignis „online“, App sichtbar, alle 30 s). Status je Protokoll: „lokal gespeichert“ / „synchronisiert“ / „Sync-Fehler“.
6. **Ablage** `/abnahme` (PC/Tablet): Suche und Filter (Kommission, Kunde, Typ, Status, Mitarbeiter, Datum), offene Mängel markiert, PDF-Download, Versand/Erneut senden, Versandprotokoll.
6a. **Löschen**: auf der Protokoll-Seite „Protokoll löschen“ (entfernt Räume, Positionen, Mängel, Fotos, Unterschriften, Original-PDF, erzeugtes PDF, Versandprotokoll und alle Nachträge). Nicht abgeschlossene Protokolle (z. B. falscher Import) darf jeder mit Zugang löschen, abgeschlossene nur CEO/Admin. Im Import gibt es „Import verwerfen“ (vor dem Anlegen). Eine ausgecheckte Kopie auf dem Tablet meldet beim nächsten Sync „gelöscht“ und lässt sich über „Lokal verwerfen“ entfernen; sie wird nicht neu angelegt.
7. **Nachtrag**: im Protokoll offene Mängel als erledigt wählen → neue Version (die alte bleibt unverändert). Der Nachtrag wird wieder auf dem Tablet geladen, unterschrieben und abgeschlossen.
8. **Regiebericht**: `/abnahme/begehung` → „Neuer Regiebericht“ (Kommission und Kunde Pflicht, Kopf vorbefüllt aus Kommission/letztem Dokument). Zeilen mit Datum, Beschreibung, Menge, Länge, Breite, Stärke, km, Stunden je Rolle (Meister, Monteur, Lehrling, Helfer; 0,5er-Schritte), Summen, „anerkannt, den …“ + Kundenunterschrift. Gleiche Technik: offline, Sync, PDF (A4 quer, DE/EN), Ablage, Versand.

PDF-Dateinamen: `Abnahme_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`, `Regiebericht_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`.

**Durchführender Mitarbeiter**: wählbar im manuellen Editor, im Abschluss der Begehung (auch offline, aus der geladenen Mitarbeiterliste) und auf der Protokollseite (online, solange nicht abgeschlossen).

**Navigation**: die Seitenleiste lässt sich ab 768 px über ‹ aus- und mit ☰ wieder einblenden (merkt sich das Gerät). **Prüfpunkt-Vorlagen** (CEO/Admin): `/abnahme/vorlagen`, je Möbeltyp eigene Punkte „Deutsch | English“; im Import und in der Begehung lassen sich zusätzlich eigene Prüfpunkte je Position ergänzen.

## Technik

- **Parser** `lib/abnahme/parser/`: `pdf-text.ts` liest Textstücke mit Position und Schrift (pdfjs-dist), `profacto.ts` ordnet sie. Regeln: Seitenkopf ignorieren (Grundlinie < 95 pt); Kopf Seite 1 dreispaltig (Kommission x < 80, Projekt x < 260, Kunde x ≥ 260); Positionszeile = Ganzzahl bei x < 80; Menge x ≈ 95, Einheit x ≈ 146; Titel = fette Textstücke bzw. alles hinter dem „/“; Folgezeilen = Langtext (auch über Seitenumbruch). Ohne Menge = Raum. Ausgeblendet: Artikel `Z_…`, „Mehrpreis“, „Minderpreis“, „Krankosten“. Doppelte/fehlende Nr. werden nicht abgewiesen, sondern gewarnt. Test mit der Beispiel-PDF: `lib/abnahme/parser/profacto.test.ts` (liegt bewusst nur lokal in `__fixtures__/`, in `.gitignore`; ohne Datei werden die Tests übersprungen).
- **Dokumentmodell** `lib/abnahme/types.ts`, DB-Abbildung `mapping.ts`, Fachlogik `logic.ts` (rein, getestet).
- **Offline**: `public/sw-abnahme.js` (Scope `/abnahme/`, Header `Service-Worker-Allowed` in `next.config.ts`). Cache der Begehungs-Shell `/abnahme/begehung` (network-first, 3 s), `_next/static`, Schriften, Logo cache-first. Alles andere unberührt, die übrige Schlutte bleibt online-only. Alle Begehungs- und Regie-Ansichten laufen in dieser einen Client-Seite (Navigation per URL-Hash), damit offline kein Next-Routing nötig ist. Daten in IndexedDB (`schlutte-abnahme`: `docs`, `blobs`, `meta`), jede Eingabe wird sofort geschrieben. Die Shell-Seite enthält keine nutzerbezogenen Daten.
- **Sync** `lib/abnahme/offline/sync.ts` + `/api/abnahme/sync`: erst Fotos/Unterschriften/PDF in den Storage, dann ein JSON-Upsert (Reihenfolge Protokoll → Kinder → bei Abschluss zuletzt der Statuswechsel). Client-UUIDs machen es idempotent. Konflikte: Protokolle werden nicht mehr ausgecheckt; Versionsprüfung über `rev` plus Abgleich (`lib/abnahme/abgleich.ts`, Dialog `AbgleichDialog`). Nur der Regiebericht hält noch einen Checkout (`abnahme_checkout`); CEO/Admin können ein Gerät freigeben.
- **PDF** `lib/abnahme/pdf/` (pdf-lib, Plex Sans, Farben aus tokens.css): läuft im Browser, also auch offline. Inhalt: Kopf, Gesamtübersicht, je Raum Materialangaben + Positionen + Prüfpunkte + Status + Langtexte, Mängelliste mit Fotos, Unterschriften, Schluss, Anhang „nicht Gegenstand der Abnahme“, Fuß „Seite x von y“. DE/EN über `lib/abnahme/i18n.ts`. Layout „Dokument“ (seit 1.1.1): offizielles Grabner-Design-Logo als Vektor (`pdf/logo.ts`), nummerierte Abschnitte links mit Messing-Unterstrich, Inhalt rechts; Mängel (M1, M2 …) in Ochsenblut mit Fotos an der Position und groß in der Mängelliste (Fotos M1.1, M1.2 …).
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
