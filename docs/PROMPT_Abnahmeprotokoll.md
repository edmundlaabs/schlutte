# Auftrag: Abnahmeprotokoll + Regiebericht als neues Schlutte-Modul `/abnahme`

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase, Repo github.com/edmundlaabs/schlutte, live: https://schlutte.vercel.app).

## Worum es geht
Die Schreinerei nimmt fertige Baustellen mit dem Kunden ab. Bisher auf Papier. Neu: Tablet-App in der Schlutte.
Ablauf: In der Werkstatt wird die Profacto-PDF „Einfache Positionsliste“ hochgeladen. Die App wandelt sie in ein Abnahmeprotokoll nach Räumen um. Auf der Baustelle (ohne Internet) begeht der Mitarbeiter mit dem Kunden Raum für Raum, hält Freigaben, Mängel mit Fotos und Bemerkungen fest und lässt unterschreiben. Daraus entsteht ein neues PDF, das abgelegt, heruntergeladen und (erneut) an den Kunden gesendet werden kann.
Im selben Modul wird auch der Regiebericht (Stundenbericht mit Kundenunterschrift) digital erfasst, siehe Teil 6.

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16: Doku in `node_modules/next/dist/docs/` lesen), `DECISIONS.md`
2. App-Register und Rechte: `lib/apps.ts`, `requireAppAccess`, Migration `20261116_app_access.sql`, `has_app_access()`, `docs/ZUGAENGE.md`
3. Kommissionen: `supabase/schema.sql` (`commissions`), `lib/data/commissions.ts`, `app/(app)/werkstatt/kommissionen` – Achtung: Schema-Datei und Spalten im Code (`commission_number`, `customer_name`, `project_name`) weichen voneinander ab. Live-Schema prüfen, bevor du darauf aufbaust.
4. PDF-Erzeugung mit `pdf-lib`: `lib/auslagen/pdf/*` (Muster für Layout, Bilder, Schrift)
5. Mailversand: `lib/urlaub/notify.ts` (Resend ist geplant, noch nicht eingebaut)
6. Neuestes Modul als Vorlage: Urlaub (`app/(app)/urlaub`, `lib/urlaub`, `20261118_urlaub.sql`)
7. Beispielunterlagen im Nachbarordner `../Abnahmeprotokoll/Content/`:
   - `Ang0--1731724496.pdf` – echte Profacto-Positionsliste (Eingangsformat)
   - `IMG_7593.JPG` – bisheriges Papier-Abnahmeprotokoll (Inhalte/Prüfpunkte übernehmen)
   - `IMG_7594.JPG` (englisch), `IMG_7595.JPG` (deutsch) – bisherige Regieberichte (Vorlage für Teil 6)
   - Weitere Unterlagen gibt es nicht.
8. Parser-Prototyp (Python): `../Abnahmeprotokoll/parser-prototyp/parse.py` – Regeln übernehmen

## Eingangsformat: Profacto „Einfache Positionsliste“ (geprüft)
- Textbasiertes PDF (Arial / Arial-Bold), A4, feste Spalten. Kein OCR nötig.
- Seitenkopf jeder Seite (Adresse, „Einfache Positionsliste“, Seite, Datum) ignorieren.
- Kopf Seite 1, drei Spalten: **Kommissionsnummer** (x < 80, z. B. `260081`), **Projekt** (x < 260, „Einbauschränke für 8142 Uitikon Waldegg“), **Kunde** (x ≥ 260, „Emily Hoon & Stephan Raemy - Uitikon Wal“ – von Profacto abgeschnitten).
- Positionszeile: Nr (x ≈ 44), Menge (x ≈ 95), Einheit (x ≈ 146: Stk, lfm, pausc), Artikelkürzel (z. B. `Z_Montage`), danach `/` und der Titel (meist fett, teils normal, teils zweizeilig fett). Folgezeilen bis zur nächsten Nr = Langtext.
- **Position ohne Menge = Raum/Bereich** (z. B. 2 „Ankleide und Highlightbereich im Schlafzimmer“, 6 „Büro und Fitnesszimmer“, 8 „Büro2 und Gästezimmer“, 11 „Treppenschrank“). Langtext enthält Materialangaben → im Protokoll beim Raum anzeigen.
- **Nicht abnahmerelevant** (standardmäßig ausgeblendet, einblendbar): Artikelkürzel beginnt mit `Z_`, Titel beginnt mit „Mehrpreis“/„Minderpreis“, „Krankosten“.
- Stolpersteine: doppelte Nr (7 zweimal), Lücken (13, 14, 16), Position über Seitenumbruch (15), Positionen ohne vorherige Raum-Überschrift.
- Erwartetes Ergebnis für die Beispiel-PDF: 20 Positionen, davon 4 Räume, 7 abnahmerelevant (3, 5, 7, 9, 12, 15, 17), 9 ausgeblendet.

## Ziel

### 1. Import in der Werkstatt (online)
- Upload der PDF, Parsing im Browser oder Server (pdf.js / `pdfjs-dist` – neue Library, im Plan begründen).
- Prüfansicht vor dem Anlegen: Kommission, Kunde, Projekt, Baustellenadresse/Ort, Räume mit Positionen.
  - **Kommissionsnummer und Kundenname sind Pflicht** und jedem Protokoll fest zugeordnet. Kundenname editierbar (Profacto schneidet ab).
  - Kommission mit vorhandener `commissions`-Zeile verknüpfen (über die Nummer); fehlt sie, anbieten sie anzulegen.
  - Positionen per Ziehen/Auswahl in anderen Raum verschieben, Räume umbenennen/neu anlegen (z. B. „Flur“, „EG“/„OG“ als Etage), ausgeblendete Positionen wieder aufnehmen.
  - Prüfpunkte je Position aus Vorlage zuweisen (siehe 3), änderbar.
- Original-PDF in Supabase Storage ablegen.
- Mehrere Protokolle pro Kommission möglich (Teilabnahme, Nachabnahme).

### 2. Begehung auf dem Tablet (offline)
- Button „Für Baustelle laden“: Protokoll inkl. aller Daten lokal speichern (IndexedDB). Ab da komplett ohne Internet nutzbar: Öffnen, Erfassen, Fotos, Unterschriften, PDF-Vorschau.
- Service Worker für `/abnahme` nötig (App-Shell offline). Nur für dieses Modul, die übrige Schlutte bleibt online-only. Ansatz im Plan beschreiben.
- Android-Tablet (Chrome) und iPad (Safari, vom Home-Bildschirm). Querformat und Hochformat, Touch-Ziele ≥ 44 px, Schrift in Eingaben ≥ 16 px.
- Aufbau:
  - **Gesamtübersicht**: Kommission, Kunde, Räume mit Fortschritt (offen / i. O. / Mangel), offene Unterschriften.
  - **Eine Seite pro Raum**, Weiterklicken/Wischen zwischen Räumen. Pro Position: Titel, Menge/Einheit, Langtext einklappbar, Prüfpunkte.
  - Status je Prüfpunkt/Position: **i. O. / Mangel / nicht prüfbar**. Mangel → Bemerkung Pflicht, Fotos (Kamera, lokal komprimiert, max. ~1600 px), optional Frist.
  - **Zusammenfassen**: „Alle Positionen im Raum i. O.“ mit einem Tipp; eine Unterschrift pro Raum. Positionen mit Mangel bekommen zusätzlich eine eigene Unterschrift. Mehrere Positionen auswählbar und gemeinsam setzen.
  - Freie Bemerkungen je Raum und zum Gesamtprotokoll.
  - Abschluss: Teilnehmer (Kunde, weitere Personen), Ort, Datum/Uhrzeit automatisch, Schlussunterschrift Kunde + Mitarbeiter. Danach gesperrt (keine Änderung mehr, nur Nachtrag).
- **Durchführender Mitarbeiter** = angemeldeter Schlutte-Nutzer (nicht frei eintippbar), weitere Monteure als Teilnehmer auswählbar.
- Unterschriftenfeld: Canvas, Löschen/Neu, gespeichert als PNG mit Zeitstempel und Name des Unterzeichners.
- Synchronisation: sobald Internet da, automatisch hochladen (Daten, Fotos, Unterschriften, PDF); sichtbarer Status „lokal gespeichert / synchronisiert“. Konflikte: ein Protokoll ist immer nur auf einem Gerät „ausgecheckt“.

### 3. Prüfpunkt-Vorlagen
- Startvorlagen aus dem Papierprotokoll: Schubladen Funktion, Türen Öffnung / Öffnungswinkelbegrenzer, LED-Beleuchtung, Erreichbarkeit Heizverteiler, Erreichbarkeit Stromverteiler, Oberfläche, geputzt.
- Vorlagen je Möbeltyp (z. B. Schrank, Regal, Garderobe, Handlauf), im Admin pflegbar. Ohne Vorlage: Position nur als Ganzes abnehmen.

### 4. PDF erzeugen (auch offline)
- Neu aufgebaut mit `pdf-lib`, **Grabner-Design-Branding der Schlutte** (Logo/Tokens wie bestehende Schlutte-PDFs), A4.
- Inhalt: Kopf (Kommission, Kunde, Projekt, Ort, Datum, Mitarbeiter, Teilnehmer), Gesamtübersicht, je Raum Materialangaben + Positionen + Prüfpunkte + Status, Mängelliste mit Fotos und Bemerkungen, Unterschriften je Raum/Position, Schlussunterschriften, Seitenzahlen „Seite x von y“, Fußzeile mit Kommission + Kunde.
- Alle Daten aus der Profacto-Liste müssen enthalten sein (Langtexte, auch ausgeblendete Positionen in einem Anhang „nicht Gegenstand der Abnahme“). Original-PDF zusätzlich abgelegt.
- Sprache DE, EN umschaltbar (Kunden in der Schweiz).
- Dateiname: `Abnahme_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`.

### 5. Ablage, Download, Versand
- Liste aller Protokolle: Suche/Filter nach Kommission, Kunde, Status, Mitarbeiter, Datum; offene Mängel markiert.
- **Download direkt auf dem Tablet**, auch offline (PDF lokal erzeugt; Android: Download-Ordner, iPad: Teilen-Menü → „In Dateien sichern“). Zusätzlich Download aus der Ablage am PC.
- „Senden“ und „Erneut senden“ an Kunden-E-Mail (+ optional interne Kopie) **über Resend**, an einer zentralen Stelle (wie in `lib/urlaub/notify.ts` vorgesehen, dort gleich wiederverwendbar bauen). Offline ausgelöster Versand wird vorgemerkt und nach dem Sync verschickt. Versandprotokoll (wer, wann, an wen, Ergebnis).
- Nach dem Synchronisieren automatischer Versand, falls bei Abschluss eine Kunden-E-Mail angegeben wurde.
- Offene Mängel nachverfolgen: als erledigt markieren → Nachtrag (neue Version des Protokolls, alte bleibt erhalten).

### 6. Regiebericht (Stundenbericht) im selben Modul
Zweiter Dokumenttyp neben dem Abnahmeprotokoll, gleiche Technik (offline, Unterschrift, PDF, Ablage, Download, Resend). Vorlage: `IMG_7595.JPG` (DE) und `IMG_7594.JPG` (EN).
- Immer Kommissionsnummer und Kunde zugeordnet (Pflicht), Kopf vorbefüllt aus `commissions` bzw. einem vorhandenen Abnahmeprotokoll: Name, Straße, Ort, Telefon, Datum.
- Feld „Auftragsbeschreibung“ (Freitext).
- Tabelle „Ausgeführte Arbeiten“, Zeilen frei ergänzbar: Pos (automatisch), Datum, Beschreibung/Material, Menge, Länge, Breite, Stärke, km einfach, Arbeitszeit in Stunden je Rolle **Meister / Monteur (Geselle) / Lehrling / Helfer** (0,5er-Schritte).
- Summen je Rolle und gesamt im PDF.
- Hinweistext unten wie auf der Vorlage: „Die Arbeitszeit versteht sich einschließlich Richten und Vorbereiten von Materialien in der Werkstatt, Fahrzeit sowie An- und Abtransport von Geräten und Werkzeugen.“ und „Grundlage der Auftragsausführung sind die Bestimmungen der VOB sowie die allgemeinen Geschäftsbedingungen des Schreinerhandwerks.“ (EN-Fassung aus `IMG_7594.JPG`).
- Abschluss: „anerkannt, den“ (Datum automatisch) + Unterschrift Kunde; durchführender Mitarbeiter = angemeldeter Nutzer.
- Sprache DE/EN.
- In der Ablage zusammen mit den Abnahmeprotokollen, filterbar nach Typ. Dateiname `Regiebericht_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`.
- Mehrere Regieberichte pro Kommission möglich.

### 7. Datenmodell (Vorschlag, im Plan finalisieren)
- `abnahme_protokolle` (commission_id, kommission_nr, kunde, projekt, ort, sprache, status, mitarbeiter_id, teilnehmer, abgeschlossen_at, pdf_path, original_path, version, parent_id)
- `abnahme_raeume`, `abnahme_positionen` (nr, menge, einheit, artikel, titel, langtext, relevant, status, bemerkung)
- `abnahme_pruefpunkte`, `abnahme_maengel` (+ Fotos), `abnahme_unterschriften` (bezug, name, rolle, bild_path, zeitpunkt), `abnahme_versand`, `abnahme_vorlagen`
- `abnahme_regieberichte` (commission_id, kommission_nr, kunde, kopfdaten, beschreibung, sprache, status, mitarbeiter_id, unterschrift, pdf_path) + `abnahme_regie_zeilen`
- `abnahme_versand` gilt für beide Dokumenttypen.
- Storage-Bucket `abnahme` (privat). RLS auf allen Tabellen über `has_app_access('abnahme')`.
- App-Register: neuer `AppKey` `"abnahme"`, Gruppe „Werkstatt und Lager“, Route `/abnahme`, Layout-Guard `requireAppAccess("abnahme")`, Kachel im Hub, Haken in der Zugänge-Matrix.

## Arbeitsregeln
- Zuerst `git status` prüfen; offene Änderungen nicht überschreiben (aktuell untracked: `docs/PROMPT_*.md`, `graphify-out/`), bei Unklarheit fragen.
- **Erst einen Plan schreiben** (Dateien, Datenmodell + Migration, Parser-Regeln, Offline-Konzept inkl. Service Worker und iPad-Speichergrenzen, PDF-Layout-Skizze, neue Libraries mit Begründung, Risiken) und mir zeigen. Bauen erst nach meinem OK.
- Eigener Branch `feature/abnahme` vom aktuellen `main`. Nichts auf main pushen, nichts deployen.
- Migration als neue Datei unter `supabase/migrations/`, **nicht ausführen** – ich führe sie aus.
- Parser mit Unit-Tests gegen die Beispiel-PDF (erwartetes Ergebnis siehe oben).
- Bestehende Tokens, Schrift und Farben aus `tokens.css`. Keine neuen Libraries ohne Begründung im Plan.
- In Schritten committen: (1) Migration + App-Register, (2) Parser + Tests, (3) Import-Ansicht, (4) Begehung offline, (5) PDF, (6) Ablage/Download/Versand, (7) Regiebericht, (8) Doku.
- Nach jedem Schritt `npm run lint` und `npx tsc --noEmit`, Fehler selbst beheben.
- Am Ende im Browser prüfen: Tablet-Größen 768 × 1024 und 1280 × 800 (hoch/quer), Offline-Modus per DevTools (Begehung komplett ohne Netz, dann Sync).
- `lib/changelog.ts`, `lib/version.ts`, `DECISIONS.md` ergänzen, Ablauf in `docs/ABNAHME.md` beschreiben.
- Unklar → nachfragen statt raten.

## Noch offen (vor dem Bauen bei mir klären)
- Prüfpunkt-Liste je Möbeltyp wird noch geklärt → bis dahin mit den Startvorlagen bauen, Vorlagen im Admin pflegbar.
- Resend: Absenderadresse/Domain und interne Kopie bei mir erfragen; API-Key nur als Env-Variable, nicht im Code.

## Ergebnis
Kurzer Bericht: Parser-Ergebnis der Beispiel-PDF, Screenshots (Import, Übersicht, Raumseite, Mangel mit Foto, Unterschrift, fertiges Abnahme-PDF, Regiebericht-Erfassung und -PDF), Offline-Test inkl. Download auf dem Tablet, offene Punkte.
