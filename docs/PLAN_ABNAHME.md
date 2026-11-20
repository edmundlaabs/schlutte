# Plan: Modul `/abnahme` (Abnahmeprotokoll + Regiebericht)

Stand: 20.11.2026 · Status: **Entwurf zur Freigabe, es wurde noch nichts gebaut.**
Branch folgt nach OK: `feature/abnahme` vom aktuellen `main` (308ce8c). Offene Änderungen im Repo (nur untracked: `docs/PROMPT_*.md`, `graphify-out/`) bleiben unberührt.

## 0. Befunde aus der Vorbereitung

| Thema | Befund | Folge |
|---|---|---|
| Live-Schema `commissions` (Supabase-Projekt `schlutte`, geprüft) | Spalten: `id uuid`, `commission_number` (char), `customer_name`, `project_name`, `notes`, `created_by_initials`, `created_at`, `updated_at`. `supabase/schema.sql` (`nr`, `client`, `project`, `status`) ist veraltet. | Wir bauen auf den **Live-Spalten** auf (`commission_id uuid` als FK, `commission_number` als Text kopiert). `schema.sql` wird nicht angefasst. |
| Storage | Buckets vorhanden: `auslagen`, `pandacad`. | Neuer privater Bucket `abnahme` per Migration. |
| Rechte | `employees.app_access text[]`, `requireAppAccess()`, `has_app_access()` vorhanden. Bestehende Mitarbeiter bekommen `abnahme` **nicht** automatisch. | Admin setzt den Haken in der Zugänge-Matrix. |
| Papierprotokoll (IMG_7593) | Zusätzlich zu euren 7 Startpunkten steht dort „Öffnung/Schließung Stromverteiler“. Spalten „Offen / Erledigt“, Teilnehmer, Ort, Datum, zwei Unterschriften, freie handschriftliche Zusatzzeile („Fachböden Regal links 2x“). | Frage 3. Freie Zusatzpunkte = Mängel ohne Vorlage. |
| Regiebericht (IMG_7594/7595) | Kopf: Name, Straße, Ort, Fon, Datum; Kommission (EN-Blatt); Tabelle Pos/Datum/Beschreibung/Menge/Länge/Breite/Stärke/km/Arbeitszeit. DE-Blatt: Meister/Monteur/Lehrling, EN-Blatt zusätzlich helper. Datum EN ausgeschrieben („February 9, 2026“). Firmenblock mit Leistungsliste im Briefkopf. | Rollen Meister/Monteur/Lehrling/Helfer wie beauftragt. Adresse/Telefon stehen **nicht** in `commissions` → Felder editierbar, vorbefüllt aus letztem Dokument derselben Kommission. |
| Python-Prototyp | Regeln klar (Spalten-x, Fett = Titel, `Z_`/Mehr-/Minderpreis/Krankosten = nicht abnahmerelevant). `pdfplumber` ist hier nicht installiert, daher Referenzlauf gegen die Beispiel-PDF erst im Parser-Schritt (Erwartung: 20 / 4 / 7 / 9). | Regeln 1:1 nach TypeScript. |

## 1. Neue Libraries (Begründung)

1. **`pdfjs-dist`**: einzige Möglichkeit, aus dem PDF Text mit Position (x/y) und Schriftart (fett/normal) zu lesen. `pdf-lib` kann nur schreiben. Läuft im Browser (Prüfansicht ohne Upload-Umweg) und in Node (Unit-Tests, `legacy`-Build). Wird per dynamischem Import nur auf der Import-Seite geladen, kein Einfluss auf die übrige Schlutte.
2. **`idb`** (ca. 1 kB): dünner Promise-Wrapper um IndexedDB. Sonst ~150 Zeilen Eigenbau mit Transaktions-Fallen. Alternative: Eigenbau, falls ihr keine Zusatz-Lib wollt.
3. **Kein SDK für Resend**: ein `fetch` an `https://api.resend.com/emails` reicht (Anhang als Base64). Keine Library.
4. Kein Workbox: der Service Worker ist klein genug (ca. 120 Zeilen), Workbox wäre mehr Build-Konfiguration als Nutzen.
5. Unterschrift: eigenes Canvas (Pointer Events, ca. 100 Zeilen), keine Library.

Bestehend genutzt: `pdf-lib` + `@pdf-lib/fontkit` (Plex Sans aus `/fonts`), `@dnd-kit` (Positionen in Räume ziehen), `node:test` für Tests.

## 2. Datenmodell + Migration

Datei: `supabase/migrations/20261120_abnahme.sql` (idempotent, wird von dir ausgeführt). Alle Tabellen mit `abnahme_`-Präfix, RLS an, Policy `using ((select public.has_app_access('abnahme')))` (CEO/Admin laufen wie bei Urlaub über denselben Weg). IDs sind **clientseitig erzeugte UUIDs**, damit offene Daten ohne Server angelegt und beim Sync idempotent per Upsert geschrieben werden.

```
abnahme_protokolle   id, commission_id → commissions, kommission_nr, kunde, projekt, ort,
                     sprache ('de'|'en'), status ('entwurf'|'bereit'|'ausgecheckt'|'abgeschlossen'),
                     typ_nachtrag bool, version int, parent_id → self,
                     mitarbeiter_id → employees, teilnehmer jsonb [{name, rolle, employee_id?}],
                     kunde_email, kopie_email, beginn_at, abgeschlossen_at,
                     original_path, pdf_path, bemerkung,
                     checkout_device text, checkout_user, checkout_at, rev int  -- Konflikt-Schutz
abnahme_raeume       id, protokoll_id, sort, name, etage, material_text (Langtext des Raums), bemerkung
abnahme_positionen   id, protokoll_id, raum_id (null = nicht zugeordnet), sort, nr, menge, einheit,
                     artikel, titel, langtext, relevant bool, vorlage_id,
                     status ('offen'|'io'|'mangel'|'nicht_pruefbar'), bemerkung
abnahme_pruefpunkte  id, position_id, sort, text_de, text_en, status (wie oben), bemerkung
abnahme_maengel      id, protokoll_id, position_id?, pruefpunkt_id?, raum_id, text, frist date,
                     erledigt_at, erledigt_in_version
abnahme_fotos        id, mangel_id, path, breite, hoehe, aufgenommen_at
abnahme_unterschriften id, protokoll_id, bezug ('raum'|'position'|'schluss_kunde'|'schluss_mitarbeiter'),
                     bezug_id, name, rolle, bild_path, zeitpunkt
abnahme_vorlagen     id, moebeltyp, titel_de, titel_en, punkte jsonb [{de,en}], aktiv, sort
abnahme_regieberichte id, commission_id, kommission_nr, kunde, name, strasse, ort, telefon, datum,
                     beschreibung, sprache, status ('entwurf'|'abgeschlossen'), mitarbeiter_id,
                     unterschrift_path, unterschrift_name, anerkannt_at, kunde_email, pdf_path, rev
abnahme_regie_zeilen id, regiebericht_id, pos, datum, text, menge, laenge, breite, staerke, km,
                     std_meister, std_monteur, std_lehrling, std_helfer   -- numeric, 0,5er-Schritte per CHECK
abnahme_versand      id, dokument_typ ('abnahme'|'regie'), dokument_id, an, kopie, status
                     ('vorgemerkt'|'gesendet'|'fehler'), fehler, ausgeloest_von, ausgeloest_at, gesendet_at
```

* **Pflicht**: `kommission_nr` und `kunde` `not null` + `check (length(trim(...)) > 0)`.
* **Abgeschlossen = gesperrt**: Trigger blockiert UPDATE/DELETE auf Kinder-Tabellen, sobald das Protokoll `abgeschlossen` ist (außer `abnahme_maengel.erledigt_*`). Änderungen nur über Nachtrag = neue Zeile mit `parent_id`, `version+1`; die alte bleibt unverändert.
* **Checkout**: `checkout_device` wird beim „Für Baustelle laden“ per RPC `abnahme_checkout(id, device)` atomar gesetzt (schlägt fehl, wenn ein anderes Gerät es hält; Admin kann „freigeben“).
* **Storage** `abnahme` (privat) per `insert into storage.buckets`; Pfade `protokoll/<id>/original.pdf`, `…/fotos/<id>.jpg`, `…/unterschriften/<id>.png`, `…/abnahme.pdf`; Storage-Policies auf `has_app_access('abnahme')`.
* Startvorlagen als Seed in `abnahme_vorlagen` (Möbeltyp „Standard“ mit den Punkten aus dem Papierprotokoll, DE+EN), Pflege im Admin-Bereich des Moduls.

## 3. App-Register (Schritt 1)

* `lib/apps.ts`: `AppKey "abnahme"`, Gruppe `werkstatt-lager`, `href /abnahme`, `enforcement "intern"`, Nav: Ablage · Import (Werkstatt) · Regiebericht · Vorlagen (nur CEO/Admin, `finance: true`). Neues Icon `abnahme` in `components/ui/AppIcon.tsx`.
* `app/(app)/abnahme/layout.tsx` mit `requireAppAccess("abnahme")`. Die Zugänge-Matrix liest aus `APPS`, braucht daher voraussichtlich nur das Register.
* `docs/ZUGAENGE.md` ergänzen.

## 4. Parser (Schritt 2)

`lib/abnahme/parser/profacto.ts`, rein funktional, ohne Browser-Abhängigkeit (Text-Items rein, Struktur raus); `pdf-text.ts` holt mit `pdfjs-dist` die Items.

Regeln (aus Prototyp und Beschreibung):
1. Pro Seite Items nach `y` zu Zeilen gruppieren (Toleranz ~2 pt), nach `x` sortieren. Seitenkopf oben und Fußzeile unten ausschneiden (feste y-Grenzen wie im Prototyp, auf Beispiel kalibriert).
2. Seite 1: Kopfzeile → Kommissionsnummer (x < 80, 6 Ziffern), Projekt (x < 260), Kunde (x ≥ 260, mit Hinweis „von Profacto abgeschnitten“).
3. Positionszeile = erstes Item ist Ganzzahl bei x ≈ 44 (± Toleranz). Menge (x ≈ 95, Dezimalkomma), Einheit (x ≈ 146), danach Artikelkürzel, `/`, Titel. Titel = fette Items oder alles hinter dem `/`; zweizeilig fett: fette Folgezeile vor jedem Langtext wird angehängt.
4. Folgezeilen bis zur nächsten Nr = Langtext (Seitenumbruch mitten in der Position bleibt in derselben Position, Seitenköpfe sind vorher entfernt).
5. Klassifizierung: ohne Menge = **Raum** (Ausnahme „Krankosten“); `Z_…`, „Mehrpreis“, „Minderpreis“, „Krankosten“ = **nicht abnahmerelevant** (ausgeblendet, einblendbar); sonst **abnahmerelevant**. Positionen ohne vorherige Raum-Überschrift landen im Pseudo-Raum „Ohne Raum“.
6. Doppelte Nr (7 zweimal) und Lücken (13, 14, 16) werden **nicht** abgewiesen; die Position behält ihre Profacto-Nr, die interne Identität ist die laufende Zeilenfolge. Anzeige-Warnung bei Duplikaten.

Tests (`lib/abnahme/parser/profacto.test.ts`, läuft mit bestehendem `npm test`): Fixture-PDF → 20 Positionen, 4 Räume, 7 relevant (3, 5, 7, 9, 12, 15, 17), 9 ausgeblendet; Kopf 260081 / Projekt / Kunde; Duplikat-Nr 7; Seitenumbruch-Position 15 vollständig; Langtext des Raums 2 enthält Materialangabe. Dazu Unit-Tests für Dateiname, Zeilengruppierung, Klassifizierung mit synthetischen Items.

## 5. Import-Ansicht (Schritt 3, online, Werkstatt)

`/abnahme/import`: PDF wählen → im Browser parsen → Prüfansicht: Kommission/Kunde (Pflicht, editierbar), Projekt, Ort/Baustellenadresse, Sprache; Räume als Spalten/Karten, Positionen per `@dnd-kit` oder „Verschieben nach…“-Auswahl (Touch-tauglich, Mehrfachauswahl); Raum umbenennen/neu (Etage-Feld); ausgeblendete Positionen per Schalter einblenden und „aufnehmen“; Prüfpunkt-Vorlage je Position (Standard: nach Titel-Stichwort vorgeschlagen, Schrank/Regal/Garderobe/Handlauf, änderbar).
Kommissions-Abgleich über `commission_number` gegen `commissions`; Treffer → Kunde/Projekt vorbelegt (Kunde bleibt überschreibbar), kein Treffer → Button „Kommission anlegen“ (nutzt die bestehende Anlage-Logik aus `lib/data/commissions.ts`).
Beim „Anlegen“: Original-PDF → Storage, Protokoll + Räume + Positionen + Prüfpunkte schreiben (Server Action, eine Transaktion über RPC). Mehrere Protokolle je Kommission erlaubt (Bezeichnung „Teilabnahme“/„Nachabnahme“ als Freitext-Titel).

## 6. Offline-Begehung (Schritt 4)

**Architektur**
* **Eine** Client-Shell unter `/abnahme/begehung?id=<uuid>`: dünne Server-Seite (Zugriffsschutz), der Rest läuft clientseitig aus IndexedDB. Raum-Navigation ist Zustand/Hash innerhalb dieser Seite, damit offline kein Next-Routing (RSC-Fetches) nötig ist. Wischen zwischen Räumen per Pointer-Events + Pfeil-Buttons.
* **Service Worker** `public/sw-abnahme.js`, Registrierung mit `scope: "/abnahme/"`; in `next.config.ts` `headers()` mit `Service-Worker-Allowed: /abnahme` und `Cache-Control: no-cache` für die SW-Datei. Nur dieses Modul: andere Pfade werden nie abgefangen.
  * Precache beim ersten Besuch von `/abnahme` und bei „Für Baustelle laden“: Begehungs-Shell (HTML), alle `/_next/static/*`-Chunks, die sie lädt, Plex-Sans-Schriften, Logo, Icons.
  * `/_next/static/*`: cache-first (hash-versioniert). Navigation zu `/abnahme/begehung`: network-first mit 3 s Timeout → Cache-Fallback (Suchparameter ignorieren). `/api/abnahme/*`: nie cachen. Alles andere: durchreichen.
  * Update: neuer SW übernimmt erst beim nächsten Start (kein Mitten-in-der-Begehung-Reload); alte Caches werden versioniert gelöscht.
* **IndexedDB** (`idb`): Stores `protokolle` (komplettes Protokoll als Dokument inkl. Räume/Positionen/Prüfpunkte/Mängel/Unterschriften-Metadaten), `blobs` (Fotos, Unterschriften-PNG), `outbox` (zu sendende Änderungen, Mail-Vormerkungen), `meta` (Gerät-ID, Nutzername, letzter Sync). Jede Eingabe wird sofort geschrieben (kein „Speichern“-Knopf).
* **Fotos**: `<input type="file" accept="image/*" capture>`, Canvas-Verkleinerung auf max. 1600 px lange Kante, JPEG ~0,8 (typisch 250–500 kB). EXIF-Ausrichtung wird beim Zeichnen berücksichtigt.
* **Unterschrift**: Canvas-Komponente (Pointer Events, Druck/Glättung), PNG mit transparentem Grund, zusammen mit Name, Rolle, Zeitstempel gespeichert; Löschen/Neu.
* **Bedienung**: Touch-Ziele ≥ 44 px, Eingaben ≥ 16 px (verhindert iOS-Zoom), Quer- und Hochformat; Übersicht mit Fortschritt je Raum (offen / i. O. / Mangel) und offenen Unterschriften; „Alle i. O.“ mit einem Tipp, Mehrfachauswahl; Mangel erzwingt Bemerkung (Abschluss und Foto-Pflicht nein, nur Bemerkung wie beauftragt); Abschluss-Dialog (Teilnehmer, Ort, Datum/Uhrzeit automatisch, Kunden-E-Mail optional, zwei Schlussunterschriften), danach gesperrt.
* **Durchführender Mitarbeiter**: angemeldeter Schlutte-Nutzer (aus Server-Kontext beim Laden in `meta` gespeichert, nicht editierbar); Teilnehmer wählbar aus `employees` (offline mitgeladen) + Freitext für Externe.

**Sync**
* Sobald online (`online`-Ereignis, App-Start, `visibilitychange`; iOS hat kein Background Sync): Outbox in Reihenfolge abarbeiten über Route Handler `/api/abnahme/sync` (Daten als JSON-Upsert, `rev`-Prüfung) und signierte Storage-Upload-URLs für Fotos/Unterschriften (große Blobs einzeln, wiederaufnehmbar). Idempotent dank Client-UUIDs.
* Sichtbarer Status je Protokoll: „lokal gespeichert“ / „synchronisiert“ / „Fehler, erneut versuchen“, mit Zähler offener Uploads.
* **Konflikte**: nur ein Gerät hat ein Protokoll „ausgecheckt“ (Server-RPC beim Laden). Andere Geräte sehen es schreibgeschützt. Rückgabe/Freigabe nach Sync; Admin kann Checkout aufheben (dann gewinnt der letzte Sync der `rev`-höheren Fassung, der andere bekommt eine Warnung statt stillem Überschreiben).
* Beim Abschluss offline wird der PDF-Erzeugungsauftrag lokal ausgeführt (Abschnitt 7); das PDF wird mit hochgeladen.

**iPad-/Speichergrenzen und Risiken**
* iOS Safari löscht Website-Daten nach 7 Tagen ohne Nutzung, **nicht** bei Installation auf den Home-Bildschirm. → Begehung nur über die installierte App empfehlen (Hinweis im Modul, vorhanden ist die Install-Anleitung), `navigator.storage.persist()` anfragen, vor dem Laden Speicherplatz prüfen (`storage.estimate()`), Warnung bei > 80 % Belegung.
* Android Chrome: persistente Speicherung ist großzügig; gleiche Warnung.
* Eine Begehung ≈ 40 Fotos × 0,4 MB + Unterschriften ≈ 20–30 MB. Unkritisch, aber **ungesynct heißt verlustgefährdet**: Gerät-Wechsel/Browserdaten löschen verliert Daten, daher Warnbanner „x Änderungen noch nicht synchronisiert“ und Sync-Hinweis beim Abschluss.
* Offline-Login: eine abgelaufene Supabase-Sitzung darf die Begehung nicht blockieren (Shell prüft nicht serverseitig); der Sync braucht eine gültige Sitzung, bei Ablauf wird beim Online-Gehen zum Login geleitet und der Sync danach fortgesetzt. Der Zugriffsschutz beim ersten Laden bleibt serverseitig.
* Next.js 16: Das Prefetching/RSC-Verhalten ist nicht mein Gedächtniswissen; vor dem Bau lese ich `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` und die Route-Handler-/Header-Doku und passe den SW-Ansatz an, falls dort abweichende Vorgaben stehen.

## 7. PDF (Schritt 5)

`lib/abnahme/pdf/*` (pdf-lib + fontkit, Muster aus `lib/auslagen/pdf`; Schrift `1-IBMPlexSans-*`; Farben aus `styles/tokens.css` übernommen: ink/muted/brass). Läuft im Browser (offline), Fonts/Logo kommen aus dem SW-Cache. Das Logo (`grabner-schlutte-logo.svg`) braucht für pdf-lib als PNG-Variante (`public/brand/…png`), ich erzeuge die einmalig aus dem SVG.

Skizze A4 hoch, Rand 42 pt, Kopf wie Auslagen-PDF (Label „Schlutte / Abnahme“ in Messing, Titel Plex Light 24):

```
S.1   Kopf: Logo · „Abnahmeprotokoll“ / „Acceptance record“
      Block: Kommission · Kunde · Projekt · Ort · Datum/Uhrzeit · Mitarbeiter · Teilnehmer
      Gesamtübersicht: Tabelle Raum | Positionen | i.O. | Mangel | nicht prüfbar | Unterschrift ✓
S.2…  je Raum: Überschrift, Materialangaben (Langtext Raum), Tabelle Positionen
      (Nr, Titel, Menge/Einheit, Status) mit Prüfpunkten eingerückt, Langtext klein;
      Bemerkung Raum; Unterschrift Raum (Bild + Name + Zeit)
      Position mit Mangel: eigener Unterschriftsblock
Mängelliste: Nr, Raum/Position, Text, Frist, Fotos (2 pro Zeile, Beschriftung), Status offen/erledigt
Schluss: Bemerkung gesamt, Unterschriften Kunde + Mitarbeiter (Ort, Datum)
Anhang „Nicht Gegenstand der Abnahme“: ausgeblendete Positionen mit Langtext
Fuß jeder Seite: „Kommission 260081 · <Kunde>“ links, „Seite x von y“ rechts
```
* Seitenzahlen „x von y“ in zweitem Durchlauf, Zeilenumbruch und Seitenumbruch über Mess-Helfer (Positionen werden nicht zerrissen), Langtexte immer vollständig. DE/EN über ein Textwörterbuch `lib/abnahme/i18n.ts` (auch für UI und Regiebericht). Dateiname: `Abnahme_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf` (Kunde-kurz: ASCII-bereinigt, max. ~20 Zeichen, erster Name). Original-PDF bleibt separat im Storage.
* Test: Node-Test erzeugt PDF aus Fixture-Daten und prüft Seitenzahl > 0, Text via pdfjs enthält alle Positionstitel (Vollständigkeit Profacto-Daten).

## 8. Ablage, Download, Versand (Schritt 6)

* `/abnahme` (Ablage): Liste beider Dokumenttypen, Suche (Kommission/Kunde), Filter Typ/Status/Mitarbeiter/Zeitraum, Badge „offene Mängel“, Sortierung nach Datum. Detail: PDF-Vorschau, Download, Versionsliste (Nachträge), Versandprotokoll, „Senden“/„Erneut senden“.
* Download am Tablet offline: lokal erzeugtes PDF → Blob; Android `<a download>`, iPad `navigator.share({ files })` (Teilen-Menü → „In Dateien sichern“), Fallback in neuem Tab. Am PC Download aus Storage über signierte URL.
* **Mail zentral**: neu `lib/mail/send.ts` (Resend per `fetch`, Env `RESEND_API_KEY`, `MAIL_FROM`, optional `MAIL_COPY_TO`; ohne Key: Eintrag im Versandprotokoll mit Status `fehler: nicht konfiguriert`, kein Absturz). `lib/urlaub/notify.ts` bleibt unverändert im Verhalten, ruft aber künftig dieselbe Funktion (Verdrahtung des Urlaubs ist **nicht** Teil dieses Auftrags, nur wiederverwendbar gebaut).
* Offline ausgelöster Versand = Eintrag in der Outbox, nach dem Sync verschickt der Server (`/api/abnahme/versand`), Ergebnis in `abnahme_versand`. Nach Abschluss mit angegebener Kunden-E-Mail: automatischer Versand nach Sync, einmalig (Idempotenz-Schlüssel je Protokoll-Version).
* Offene Mängel: „als erledigt markieren“ legt einen **Nachtrag** an (Version n+1, `parent_id`), die alte Version bleibt unverändert und abrufbar.

## 9. Regiebericht (Schritt 7)

Gleiche Technik (IndexedDB, SW, Sync, PDF, Ablage, Versand). Routen: `/abnahme/regie/neu`, `/abnahme/regie/[id]` (Shell wie Begehung, offline fähig). Kopf vorbefüllt aus `commissions` + letztem Dokument derselben Kommission (Name, Straße, Ort, Telefon); Datum automatisch; Auftragsbeschreibung Freitext; Zeilenerfassung (Pos automatisch, Datum, Text/Material, Menge, Länge, Breite, Stärke, km einfach, Stunden je Rolle mit Stepper in 0,5er-Schritten); Summen je Rolle und gesamt live und im PDF; Hinweistexte DE/EN wie auf den Vorlagen; Abschluss „anerkannt, den <Datum>“ + Kundenunterschrift, Mitarbeiter = angemeldeter Nutzer; danach gesperrt. PDF A4 quer (wie Papiervorlage, Querformat erleichtert die breite Tabelle), mehrere Seiten bei vielen Zeilen, Dateiname `Regiebericht_<Kommission>_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`.

## 10. Dateiübersicht (neu)

```
supabase/migrations/20261120_abnahme.sql
lib/apps.ts (+Icon), components/ui/AppIcon.tsx
app/(app)/abnahme/{layout,page}.tsx  import/  begehung/  regie/  vorlagen/  [id]/
app/api/abnahme/{sync,versand}/route.ts
lib/abnahme/{types,i18n,filename}.ts
lib/abnahme/parser/{profacto,pdf-text}.ts + profacto.test.ts + __fixtures__/
lib/abnahme/offline/{db,sync,sw-register,storage-check}.ts
lib/abnahme/pdf/{protokoll,regie,common}.ts
lib/data/abnahme.ts
lib/mail/send.ts
components/abnahme/*  (SignaturePad, PhotoCapture, RaumSeite, PositionKarte, ImportReview, …)
styles/abnahme.css (Tokens aus tokens.css)
public/sw-abnahme.js, public/brand/…png, next.config.ts (Header)
docs/ABNAHME.md, DECISIONS.md, lib/changelog.ts, lib/version.ts (1.1.0)
```

## 11. Reihenfolge der Commits

1 Migration + App-Register · 2 Parser + Tests · 3 Import-Ansicht · 4 Begehung offline (+SW, Sync) · 5 PDF · 6 Ablage/Download/Versand · 7 Regiebericht · 8 Doku/Changelog/Version. Nach jedem Schritt `npm run lint` + `npx tsc --noEmit`; am Ende Browser-Prüfung (768×1024 und 1280×800, hoch/quer, DevTools-Offline: Begehung komplett ohne Netz, dann Sync) und Bericht mit Screenshots.

## 12. Weitere Risiken

* **Profacto-Layout-Varianten**: Parser ist auf eine einzige echte Datei geeicht. Gegenmaßnahme: Prüfansicht zeigt Warnungen (kein Kopf, Doppelnr, Position ohne Raum); weitere Muster-PDFs wären wertvoll.
* **Schlutte-Kunde-Kurzname** im Dateinamen: Sonderzeichen/Umlaute werden bereinigt, nur ASCII.
* **Fremde Nutzer auf Baustellen-Tablets**: Gerät ist ein Schlutte-Konto; bei geteilten Tablets zählt der angemeldete Nutzer als „durchführender Mitarbeiter“.
* **Supabase Storage-Größe**: Fotos 1600 px; Aufbewahrungsdauer nicht definiert (Frage 6).
* **Migration muss laufen, bevor die Seite Daten lädt**; ohne sie zeigt das Modul eine Hinweisseite (Muster Urlaub/Zugänge).

## 13. Offene Fragen an dich

1. Darf die Beispiel-PDF (Kundendaten) als Test-Fixture ins Repo (`lib/abnahme/parser/__fixtures__/`)? Sonst lokal-only und der Test überspringt sich ohne Datei.
2. `idb` als kleine Zusatz-Lib in Ordnung (sonst Eigenbau)?
3. Startvorlage um „Öffnung/Schließung Stromverteiler“ (steht auf dem Papierprotokoll) ergänzen?
4. Resend: Absenderadresse/Domain, Betreff-Format, interne Kopie-Adresse. API-Key kommt nur als Env-Variable (`RESEND_API_KEY`), nicht in den Code.
5. Regiebericht-PDF in A4 **quer** (wie die Papiervorlage) ok?
6. Aufbewahrungsfrist/Löschkonzept für Fotos und Unterschriften (DSGVO, Kunden in der Schweiz)?
7. Version nach Abschluss: 1.1.0 mit Release-Popup oder ohne Popup?
