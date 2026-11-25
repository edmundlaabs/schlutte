


# Schlutte — Designentscheidungen

Stand: 2026-05-26 (Skelett, Daten-Kapselung & Browser-Druck implementiert).

## Designvarianten aus dem Export

| Bereich              | Gewählt                       | Quelle im Export                              |
|----------------------|-------------------------------|-----------------------------------------------|
| Navigation / Shell   | **A — Topbar voll**           | `section-navigation.jsx` → `NavVariantA`      |
| Dashboard            | **A — Action-first**          | `section-dashboard.jsx` → `DashboardA`        |
| Kommissionsdetail    | **B — Tabelle, dicht**        | `section-commission.jsx` → `CommissionB`      |
| Laufzettel-Druck A4  | **wie Palette A** (Zahl dominant, Klassisch) | abgeleitet von `PrintPaletteA` |
| Paletten-Druck A4    | **A — Klassisch, Zahl dominant** | `section-print-palette.jsx` → `PrintPaletteA` |

## Architektur

- **GitHub** ist die Codebasis. **Vercel** deployed die Next.js-App.
- **Supabase** liefert die Live-Datenbank (Tabellen: `employees`, `commissions`, `documents`, `document_prints`).
- Keine Secrets im Repo. Konfiguration ausschließlich über Umgebungsvariablen
  (lokal `.env.local`, in Vercel über das Projekt-Setting).
- Keine lokalen Dateisystem-Abhängigkeiten — alles serverless-kompatibel.

## Daten

- **Mock-Daten werden über Data-Funktionen gekapselt.** Pages und Komponenten
  importieren ausschließlich aus `lib/data/*`, nie direkt aus `mocks/*`.
- **Supabase ist live angebunden.** Die Daten-Funktionen in `lib/data/commissions.ts` und `lib/data/documents.ts` lesen und schreiben live in die Supabase-Datenbank.
- **Transparenter Fallback auf Mock-Daten:** Wenn die Datenbank leer ist, bei RLS-Fehlern (wenn keine aktive Sitzung besteht) oder bei Verbindungsproblemen greift die Data-Schicht automatisch auf die lokalen Mock-Daten in `mocks/data.ts` zurück, so dass lokales Entwickeln und Testen unterbrechungsfrei möglich sind.
- **Write-Pfad-Konvention:** Mutationen laufen über Next.js Server Actions
  (`"use server"`) in Routen-nahen `actions.ts`-Dateien, die wiederum die Data-Schicht aufrufen, `revalidatePath` ausführen und bei Erfolg weiterleiten. Die Data-Schicht wirft typisierte Fehler, die von den Server Actions an die Formulare gereicht werden.
- Mock-Daten leben isoliert unter `mocks/data.ts` und werden später entfernt, sobald Auth und RLS-Registrierung vollständig in der UI verankert sind.

## Druck

- **Print zunächst über HTML/CSS und Browser-Druck** (`window.print()`).
- A4 Querformat via `@page { size: A4 landscape; margin: 0 }` und `@media print`.
- Eigene Route-Group `app/print/` mit eigenem Layout — kein Topbar, kein
  Theme-Switch, immer hell (`color-scheme: light`).
- Mehrfachdruck Palette: `idx von total` (z. B. 1/5 … 5/5), eine Seite pro Aufruf;
  Batch-Druck später durch parallele Renderings + `page-break-after: always`.
- **PDF-Archivierung kommt später** über Supabase Storage. Server-seitiges
  Rendering dann via Headless Chromium (Playwright) auf einem separaten Worker —
  Vercel-Functions kommen dafür nicht in Frage (binäre Abhängigkeiten,
  Laufzeitlimits).
- Kein QR-Code im MVP.

## Drucklayout-Regeln (verbindlich)

- Drucklayouts bleiben immer hell. Dark-Mode existiert nur in der App-UI.
- Kommissionsnummer ist visuell dominant (200 px Display, light weight).
- Brass-Akzent `#A6824A` nur für Eyebrows / Index, nie für Flächen.
- Hairlines statt Schatten. Scharfe Ecken.

## Supabase-Schema (Produktiv)

Die Tabellen wurden verifiziert und die Data-Schicht auf das reale Schema angepasst:

- `commissions`
  - `id` (uuid, Primary Key)
  - `commission_number` (text, 6 Ziffern)
  - `customer_name` (text)
  - `project_name` (text, optional)
  - `notes` (text, optional)
  - `created_by_initials` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
- `documents`
  - `id` (uuid, Primary Key)
  - `commission_id` (uuid references commissions)
  - `document_type` (text: 'laufzettel' | 'palette')
  - `title` (text, z.B. "Laufzettel")
  - `form_data` (jsonb, strukturiert nach `LaufzettelFormData` / `PaletteFormData`)
  - `created_by_initials` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
- `document_prints`
  - `id` (uuid, Primary Key)
  - `document_id` (uuid references documents)
  - `print_label` (text, z.B. "Palette 1 / 5")
  - `pdf_url` (text, optional)
  - `created_by_initials` (text)
  - `created_at` (timestamptz)
- `employees`
  - `id` (uuid, Primary Key)
  - `initials` (text)
  - `name` (text)
  - `is_admin` (boolean)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

- **Druck-Protokollierung:** Jeder Druckauftrag (Einzelseite oder Bereich) wird in der Tabelle `document_prints` protokolliert (sofern Berechtigungen dies zulassen).
- **RLS aktiv:** MVP-Policies verlangen für Schreiboperationen einen angemeldeten Benutzer (authenticated). RLS-Fehlermeldungen werden an den Client als nutzerfreundliche Fehlermeldungen durchgereicht.
- **Dokumenten-Speicherung:** Dokumente (Laufzettel und Palettenbeschriftungen) werden live in der Tabelle `documents` in Supabase gespeichert.
- **Formulardaten (form_data):** Alle dokumentenspezifischen Felder werden als JSONB im Feld `form_data` abgelegt:
  - *Laufzettel:* `area`, `componentName`, `material`, `surface`, `note`, `employeeInitials`, `categories`
  - *Palette:* `objectName`, `dimensions`, `positionNumber`, `packageCount`, `shippingNote`, `employeeInitials`
- **Kommissionsdetailseite:** Die Detailseite (`/werkstatt/kommissionen/[nr]`, früher `/kommissionen/[nr]`) lädt alle zugehörigen Dokumente aus Supabase und stellt sie in den jeweiligen Tabellen bzw. Rastern dar.

## Authentifizierung & Berechtigungen

- **Supabase Auth** ist als MVP-Voraussetzung integriert, um die Authentifizierung auf Datenbank-Ebene für RLS (Row Level Security) bereitzustellen.
- **Rollen und Rechte im MVP:** Alle angemeldeten Benutzer (authenticated) besitzen die gleichen Rechte und können Kommissionen und Dokumente erstellen, bearbeiten und drucken.
- **Zukünftige Erweiterung:** Feingranulare Rollenrechte, Admin-Rechte (z. B. für das Verwalten von Vorlagen) sowie die Kopplung an das `employees`-Schema sind für spätere Versionen vorgesehen.

## Offen

- Format/Sequenz der Kommissionsnummer (aktuell 6-stellig `260050`; Jahres-Präfix?).
- Bucket-Namen für Supabase Storage (`documents`, ggf. `templates`).

## Meilenstein: Formulare & Print-Finalisierung (2026-05-26)

- **Printlayouts für Laufzettel und Palettenbeschriftung** sind voll funktionsfähig und als MVP-Kern im A4-Querformat implementiert.
- **Formulare zur Dokumenterstellung** (neue Kommission, Laufzettel und Paletten) sind als clientseitige Formulare mit Server-Actions (für Kommission) / Client-Zustand (für Dokumente) vorbereitet, um die spätere Supabase-Anbindung minimalinvasiv zu gestalten.
- **Dauerhafte Speicherung** und Authentifizierung erfolgen im nächsten Schritt über Supabase.
- **HTML/CSS-Browserdruck** bleibt der primäre MVP-Druckweg, da er sich nahtlos über `@media print` und `break-after` konfigurieren lässt.
- **PDF-Archivierung** wird nachgelagert über einen separaten Worker mit Supabase Storage angebunden.

## Meilenstein: Admin- & Interne Ergänzungen (2026-05-26)

### Mitarbeiter & Kürzel

- **Mitarbeiterverwaltung** erfolgt über die bestehende `employees`-Tabelle in Supabase.
- **Kürzel** sind 1–3 Zeichen, werden uppercase gespeichert, müssen eindeutig sein.
- **Inaktive Mitarbeiter** werden per `is_active = false` behandelt (Soft-Delete bevorzugt). Historische Dokumente behalten ihr Kürzel.
- **Echter DELETE** ist nur möglich, wenn kein Dokument oder Druckauftrag auf das Kürzel verweist. Sonst Fallback auf Soft-Delete.
- **Auth-Verknüpfung:** Die Supabase Auth-Registrierung (Auth Dashboard) ist separat von der `employees`-Tabelle. Die `employees.id` muss der Supabase Auth-User-UUID entsprechen, damit die Topbar-Verknüpfung funktioniert.
- **Schema-Erweiterung:** `email` und `updated_at` werden optional über die Migration `20260526_add_employee_fields.sql` ergänzt.

### Datumsausgabe

- **Alle sichtbaren Datumsangaben** erscheinen im Format `TT.MM.JJJJ`.
- Die zentrale Utility-Funktion `formatDate()` (in `lib/utils.ts`) ist der einzige Ort für Datumsformatierung.
- Optional: `formatDateTime()` → `TT.MM.JJJJ, HH:mm`.
- Supabase speichert und liefert weiterhin `timestamptz`.

### Begrüßung

- **Tageszeit-abhängige Begrüßung** auf dem Dashboard:
  - 05:00–10:59 → „Guten Morgen, Name."
  - 11:00–17:59 → „Guten Tag, Name."
  - 18:00–04:59 → „Guten Abend, Name."
- Fallback: „Willkommen in Schlutte." wenn kein Name verfügbar.
- Name wird aus `employees.name`, dann `employees.initials`, dann `email`-Prefix ermittelt.
- Logik in `getGreeting()` in `lib/utils.ts`.

### Versionierung

- **Zentrale Version** in `lib/version.ts` als `APP_VERSION`-Konstante.
- Wird neben dem Logo in der Topbar (BrandMark) angezeigt.
- Im Drucklayout ausgeblendet (`@media print { .grb-brand-version { display: none } }`).
- Auf der Feedback-Seite als „aktuell"-Badge beim Changelog-Eintrag sichtbar.

### Feedback

- **Feedback** wird in der Supabase-Tabelle `feedback` gespeichert.
- **Status-Werte:** `offen`, `beantwortet`, `erledigt`.
- **RLS:** Alle authenticated users dürfen Feedback erstellen, lesen und Status ändern (MVP — später auf Admin einschränken).
- **Antwort-Felder:** `response_text`, `response_by_initials`, `response_at`.
- Kein Service-Role-Key im Frontend. Kein Webhook. Nur direkte Supabase-Datenbankoperationen.
- **Floating-Button „Feedback an Eddy"** in der App-Shell (unten rechts, fixiert). Nicht auf Druckseiten.

### Changelog

- **Statisch gepflegt** in `lib/changelog.ts` — kein Datenbank-Eintrag nötig.
- Neue Einträge oben einfügen (neueste zuerst).
- Auf der Feedback-Seite als „Update-Info"-Abschnitt sichtbar.

### SQL-Migrationen

- `supabase/migrations/20260526_add_employee_fields.sql` — manuell im Supabase SQL-Editor ausführen.
- `supabase/migrations/20260526_create_feedback_table.sql` — manuell im Supabase SQL-Editor ausführen.

## Auftragsoberfläche (Muster) — Imposition A4 quer (2026-11-17)

- **Neuer `document_type`:** `oberflaeche`. Ein Dokument = ein Inhalt, `labelCount` identische Kopien (Integer ≥ 1, Pflicht). `form_data` nach `OberflaecheFormData`.
- **Label:** exakt A5 hochkant (148 × 210 mm), Komponente `components/print/OberflaecheLabel.tsx`. Lange Texte über `FitText`, Rahmen `overflow: hidden`. Nur 100 % Schwarz, Hairlines, scharfe Ecken (wie Palette).
- **Imposition:** Ausgabe immer auf A4 quer (297 × 210 mm), je Blatt zwei A5-Labels nebeneinander, 100 % Größe, keine Skalierung. Gerade Anzahl: alle Blätter voll. Ungerade Anzahl: letztes Blatt nur links. 1 → 1 Blatt, 3 → 2 Blätter, 5 → 3 Blätter.
- **Warum kein globales `@page`:** Das globale `@page { size: A4 landscape }` in `styles/print.css` gilt ohnehin für alle Vorlagen; die neue Vorlage nutzt eigene Klassen (`.imposition-sheet`, `.imposition-slot`) ohne Padding. `.print-sheet` (Palette/Laufzettel) bleibt unverändert.
- **Schnittmarken:** je 1 cm lang, 1 pt breit, oben und unten auf der Mittellinie (148,5 mm) jedes Blatts, **4 mm vom Papierrand nach innen versetzt**, weil Drucker meist ~4 mm Rand nicht bedrucken.
- **Datenbank:** `documents_document_type_check` war ein Check-Constraint (`laufzettel`, `palette`). Migration `supabase/migrations/20261117_documents_add_oberflaeche.sql` muss manuell im SQL-Editor ausgeführt werden. Ohne sie schlägt das Speichern fehl (verständliche Fehlermeldung).
- **Zählung je Kommission:** `getDocumentCountsByCommission` zählt `oberflaeche` getrennt (vorher wäre alles Nicht-Palette als Laufzettel gezählt worden).
- **Zuordnung zur App „Druckvorlagen Büro/Personal“ (Kachel 03, App-Key `personal`):** Die Auftragsoberfläche gehört nicht zur Werkstatt. Eigene Routen `/personal` (Startseite), `/personal/oberflaeche` (Kommission wählen), `/personal/oberflaeche/[nr]/neu` und `…/[nr]/[id]/bearbeiten`, Druck unter `/print-personal/oberflaeche/document/[id]` mit eigenem Layout und Zugriffsschutz `requireAppAccess("personal")`. Aus Werkstatt-Dashboard, Dokumenttyp-Auswahl und Vorlagenliste ist sie entfernt. Die Kommissionsseite zeigt die Dokumente weiter und verlinkt in die Personal-Routen.


## Navigation, Layout und Modulstruktur (Version 0.3.0)

- **Ein Rahmen für alle Seiten:** `components/shell/AppShell.tsx` im Layout der Route Group `app/(app)`. Zeile 1 überall gleich: Logo (→ `/`), App-Wechsler, Breadcrumb, Feedback-Icon, Avatar-Menü (Mein Konto, Passwort ändern, Admin nur CEO/Admin, Design, App installieren, Abmelden). Zeile 2: Tabs der aktuellen App, mobil (< 768 px) als Tab-Leiste unten. Keine Suche, bis es eine globale Suche gibt.
- **Benutzerdaten serverseitig:** Name, Kürzel, Rolle und freigeschaltete Apps lädt das Layout über `getCurrentUserContext()` und übergibt sie als Props. Das Self-Provisioning des Mitarbeiter-Eintrags steckt dort ebenfalls (`lib/auth/provision.ts`).
- **Eine Quelle:** `lib/apps.ts` (App-Register) liefert Startseite, Wechsler und Tabs (`href`, `group`, `icon`, `nav`). Admin-Tabs: `ADMIN_NAV`. `AppKey`s sind unverändert (`employees.app_access`, RLS `has_app_access`).
- **Alles liegt in der Schlutte:** keine externen Kacheln mehr. `warenbestand` hat die interne Route `/warenbestand` (Umzugshinweis mit Weiterleitung auf die bisherige App, bis der Warenbestand portiert ist).
- **Routen:** `/` Startseite (vorher `/start`), `/werkstatt/...` (Dashboard, Kommissionen, Archiv, Dokument erstellen), `/admin/...` (Mitarbeiter, Zugänge, Feedback-Eingang; Layout mit `hasAdminRights`), `/feedback` bleibt das Formular für alle. `/personal`, `/auslagen`, `/bestellliste`, `/pandacad`, `/gerda`, `/print/*` unverändert; `/print/*` ohne Shell. `/vorlagen` entfernt.
- **Redirects:** alte URLs leiten per 301 in `next.config.ts` (`redirects()`) um: `/start`, `/kommissionen/*`, `/archiv/*`, `/dokument-erstellen/*`, `/mitarbeiter/*`, `/mitarbeiter/zugaenge`, `/vorlagen`.
- **Zugriff:** `requireAppAccess(key)` in jedem App-Layout (neu auch Werkstatt und Warenbestand); RLS unverändert. `/` verlangt nur Anmeldung, keine App-Freischaltung.
- **Gerda:** läuft im Rahmen; Gerdas eigene Ansichts-Tabs (Personen) bleiben als zweite Leiste unter der Shell, Logo und „Zurück zum Intranet“ entfallen. Gerda-CSS ist auf `.gerda-root` begrenzt.


## Schlutte als Handy-App (Version 0.4.0)

- **Eine App, ein Manifest:** `public/schlutte.webmanifest` mit `start_url: "/"`, `id` bleibt `"/start"` (sonst gilt es auf Android als neue App). `auslagen.webmanifest` und die Beleg-Icons sind entfernt; Auslagen ist Teil der Schlutte.
- **Icons:** eigenes g-Zeichen aus dem Schlutte-Logo auf dunklem Grund (`public/icons/schlutte-{180,192,512,maskable-512}.png`), Quelle als SVG in `docs/icon-entwurf/`.
- **Einrichtung gerätespezifisch** (`lib/install.ts`, `components/install/*`): iOS Safari, iOS anderer Browser (Hinweis „In Safari öffnen“), Android (`beforeinstallprompt`, sonst ⋮-Anleitung), Desktop (QR-Code). Das Sheet liegt einmal in der `AppShell` und wird per Ereignis geöffnet, weil das Avatar-Menü bei Klick außerhalb schließt. Am Desktop ist es eine zentrierte Karte statt eines Popovers im Menü.
- **Öffentlich:** `/app` (in `proxy.ts` freigegeben, ohne Shell); der QR-Code zeigt auf `<APP_URL>/app`. App-URL aus `NEXT_PUBLIC_APP_URL`, Fallback aktuelle Origin.
- **Hinweis-Streifen:** nur Handy, nicht installiert, nicht auf `/login` und `/print*`; nach „×“ 30 Tage Ruhe (`localStorage`).
- **Kein Service Worker, kein Offline-Modus:** iOS braucht keinen für den Home-Bildschirm; Daten müssen aktuell sein.
- **Mobil-Layout:** `styles/mobile.css` (unter 768 px) überschreibt Inline-Maße gezielt per `!important`; Hilfsklassen `m-page`, `m-hero`, `m-grid-1`, `m-krow`. Gerda-Anpassungen nur in `gerda.css` unter `.gerda-root`.
- **Gerda-HTTP-500:** `localStorage` im `useState`-Initialisierer von `TaskBoard` lief beim Server-Rendering; jetzt erst nach dem Mount.



## Modul Abnahme: Abnahmeprotokoll und Regiebericht (Version 1.1.0, 2026-11-20)

- **Neue App `abnahme`** (Gruppe „Werkstatt und Lager“, Route `/abnahme`, `requireAppAccess("abnahme")`, RLS über `has_app_access('abnahme')`). Migration `20261120_abnahme.sql` wird manuell im SQL-Editor ausgeführt. Bestehende Mitarbeiter bekommen den Zugang nicht automatisch.
- **Live-Schema statt `schema.sql`:** `commissions` hat live `commission_number`, `customer_name`, `project_name` (die Schema-Datei mit `nr`/`client` ist veraltet). Die Abnahme speichert `commission_id` (FK) plus kopiert `kommission_nr`/`kunde` ins Protokoll; Kunde bleibt editierbar (Profacto schneidet ab).
- **Neue Libraries:** `pdfjs-dist` (einzige Möglichkeit, Text mit Position und Schrift aus dem PDF zu lesen; nur auf der Import-Seite per dynamischem Import) und `idb` (dünner IndexedDB-Wrapper). Kein Resend-SDK (ein `fetch`), kein Workbox (Service Worker ca. 100 Zeilen), keine Signatur-Library (eigenes Canvas).
- **Offline nur für `/abnahme`:** Service Worker `public/sw-abnahme.js` mit Scope `/abnahme/`; alles andere bleibt online-only (Entscheidung „Kein Service Worker“ aus Version 0.4.0 gilt für den Rest weiter). Eine einzige Client-Seite `/abnahme/begehung` bedient Begehung **und** Regiebericht (Navigation per URL-Hash, Daten aus IndexedDB); sie enthält keine nutzerbezogenen Props, damit der Cache keine fremden Daten ausliefert.
- **Sync statt Konfliktauflösung:** ein Dokument ist nur auf einem Gerät „ausgecheckt“ (RPC `abnahme_checkout`), Client-UUIDs, Upsert, `rev`-Prüfung. Abgeschlossene Dokumente sind per Trigger gesperrt; Änderungen nur über einen Nachtrag (neue Version, alte bleibt erhalten).
- **PDF im Browser** (pdf-lib), damit es offline entsteht; Schlussunterschriften und Statuswechsel werden erst nach dem Hochladen von PDF und Bildern gesetzt.
- **Mail zentral** in `lib/mail/send.ts` (Resend, Env `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_COPY_TO`); `lib/urlaub/notify.ts` kann sie wiederverwenden (noch nicht verdrahtet). Offline ausgelöster Versand wird vorgemerkt und nach dem Sync verschickt; automatischer Versand ist idempotent über einen Schlüssel je Dokumentversion.
- **Parser-Fixture nur lokal:** Die Beispiel-PDF (Kundendaten) liegt in `lib/abnahme/parser/__fixtures__/` und steht in `.gitignore`; ohne Datei werden diese Tests übersprungen.
- Details und Betrieb: `docs/ABNAHME.md`.

## Abnahme-Redesign „Dokument“ (Version 1.1.1, 2026-11-20)

- **Seitenleiste statt Tab-Zeile** nur für Apps mit `sideNav: true` in `lib/apps.ts` (bisher nur Abnahme). `SubNav` blendet dort ab 768 px die Tab-Zeile aus; mobil bleibt die Tab-Leiste unten. In `/abnahme/begehung` und unter 1100 px ist die Leiste schmal (nur Nummern).
- **Logos:** App = g-Signet mit Kreis (`public/brand/grabner-g.svg`, aus `GD/001_Grabner Logo/cleanes logo/cleanes_g_kreis_in_black.ai`). Offizielle PDFs = Grabner-Design-Logo als Vektorpfade (`lib/abnahme/pdf/logo.ts`, Quelle `public/brand/grabner-logo.svg`), kein PNG-Rendering mehr nötig.
- **IBM Plex Mono nicht im PDF:** Die Mono-TTFs in `public/fonts` lassen sich mit `@pdf-lib/fontkit` nicht einbetten („Trying to access beyond buffer length“, Fehler erst bei `save()`). Zahlen im PDF daher in Plex Sans; `Fonts.mono` zeigt auf Regular.
- **PDF-Farben** aus `tokens.css` (`lib/abnahme/pdf/common.ts`): Mangel = Ochsenblut `#8C3A2E`, Akzent = Messing, Haarlinien = Sand.
- Entwurf: Design-Canvas „Schlutte Abnahme – Redesign“ (Zeile „Final“). Backup der vorherigen Dateien: `../Backup/abnahme-redesign-2026-11-20/`.
- **Löschen (Abnahme):** über Server Action mit Service-Role-Client, weil der DB-Trigger das Löschen abgeschlossener Protokolle für normale Nutzer sperrt; die Berechtigung prüft die Action (abgeschlossen = nur CEO/Admin). Nachträge werden mit gelöscht (`parent_id` ist `restrict`). Dateien bleiben erhalten, solange ein verbleibendes Protokoll darauf verweist (Nachträge zeigen auf Bilder der Vorversion). Der Sync legt ein serverseitig gelöschtes Protokoll nicht neu an (HTTP 410).
- **Navigation der Abnahme** ist ab 768 px ein-/ausblendbar (localStorage `abnahme-nav-aus`).

## Abnahme: manuell anlegen, ohne Kommission, Protokoll-Vorlagen (Version 1.2.0, 2026-11-25)

- **Migration `20261125_abnahme_manuell.sql`** (manuell ausführen): `abnahme_protokolle.kommission_nr` nullable (Check: nicht leer, und ohne Nummer keine `commission_id`), neue Spalte `quelle` (`profacto`/`manuell`/`vorlage`, Bestand = `profacto`), neue Tabelle `abnahme_protokoll_vorlagen` mit RLS wie `abnahme_vorlagen`. Der Regiebericht bleibt bei Pflicht-Kommission.
- **„Ohne Kommission“ = leerer String im Modell, `NULL` in der DB** (`mapping.ts` bildet beides ab). Dadurch bleiben Typen und IndexedDB-Altbestand gültig; Anzeige über `kommissionAnzeige()`, Dateiname `Abnahme_ohne-Kommission_…`.
- **Eine Server-Action `legeProtokollAn`** für Import und manuell (Modus bestehend/neu/ohne). Der Server prüft mit derselben Funktion wie der Browser (`validiereNeuesProtokoll`), schlägt „bestehend“ selbst nach und legt „neu“ erst beim Speichern an (Nummer muss frei sein).
- **`quelle` setzt nur der Server** (beim Anlegen); der Sync verwirft sie, damit ein älteres Tablet-Dokument ohne dieses Feld sie nicht auf `profacto` zurücksetzt.
- **Nachträgliche Kommissions-Zuordnung** nur online, nicht abgeschlossen und nicht ausgecheckt (sonst überschriebe der nächste Tablet-Sync sie).
- **Protokoll-Vorlagen als `jsonb`** (immer als Ganzes geladen, nie inhaltlich abgefragt, wie `abnahme_vorlagen.punkte`). Verweis auf die Möbeltyp-Vorlage per ID ohne Fremdschlüssel; beim Einfügen fehlende/inaktive Vorlagen → Hinweis, Position ohne diese Prüfpunkte. Einfügen führt Räume gleichen Namens zusammen, vergibt neue IDs und hängt Positionen an.
- **Entwurf des manuellen Editors in localStorage** (reiner Text, Schlüssel je Mitarbeiter), nicht IndexedDB: keine Blobs, einfacher; die IndexedDB bleibt der Begehung vorbehalten.
- **`StrukturEditor`** (Räume/Positionen/Prüfpunkte) ist gemeinsam für Import und manuellen Editor; im Import lassen sich Prüfpunkte dadurch jetzt auch umbenennen und löschen.
- Keine neuen Libraries. Nicht gebaut (Optionen): Anlegen offline auf dem Tablet, Regiebericht mit derselben Auswahl inkl. „ohne Kommission“.
