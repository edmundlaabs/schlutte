# Auftrag: Schlutte – Zugänge-Matrix + PandaCAD-Installationsseite (Phase 1 + 2)

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase, Repo github.com/edmundlaabs/schlutte).
Supabase-Projekt: `schlutte` (ID `jxbsymuaifwnltogizwf`).

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md`, `DECISIONS.md`, `docs/ZUGAENGE.md`
2. `lib/apps.ts` (App-Register, `resolveAppAccess`)
3. `app/(app)/mitarbeiter/` (`EmployeeForm.tsx`, `actions.ts`, `page.tsx`): Haken pro App gibt es dort schon
4. `components/intranet/IntranetHub.tsx` (Hub-Kacheln)
5. `requireAppAccess()` und die DB-Funktion `public.has_app_access(key)` (Migration `20261116_app_access.sql`)

## Zielbild (Kontext, nicht alles jetzt bauen)
Alle Firmen-Apps werden Module der Schlutte: ein Login, eine Datenbank, Rechte pro Mitarbeiter und App (Zugriff ja/nein). CEO/Admin haben immer alles.
Spätere Phasen (NICHT in diesem Auftrag): Gerda → `/gerda`, Warenbestand WERK 2 → `/warenbestand`, nic → `/projekte`, Urlaubsantrag.
Plan: `docs/PLAN-ZUSAMMENFUEHRUNG.md` (lege die Datei an, Inhalt siehe unten).

## Arbeitsregeln
- Erst einen Plan schreiben (Dateien, Migrationen, Risiken) und mir zeigen. Mit dem Bauen erst nach meinem OK beginnen.
- Eigener Branch `feature/zugaenge-pandacad`. Nichts auf main pushen, nichts deployen.
- Migrationen nur als Datei in `supabase/migrations/` anlegen. Gegen die Live-DB erst nach meinem OK ausführen.
- Bestehende Muster und Styles nutzen (`styles/intranet.css`, `components/ui`), keine neuen Libraries ohne Rückfrage.
- Am Ende `npm run lint` und Typecheck (`npx tsc --noEmit`). Fehler selbst beheben.
- Keine Zugangsdaten oder Lizenzschlüssel in Code, Seiten oder Commits.
- Unklar → nachfragen statt raten.

## Datensicherung (Pflicht, alle bestehenden Daten müssen erhalten bleiben)
- Vor JEDER Migration und jedem Datenumzug: Backup des betroffenen Projekts nach `../Backup/<projekt>_<JJJJ-MM-TT_HHMM>/`, und zwar Struktur (`supabase db dump`), Daten (`supabase db dump --data-only`) und Storage-Dateien (Skript mit Service-Role-Key, alle Buckets). Ohne bestätigtes Backup keine Migration.
- Migrationen nur additiv: keine `drop table`, `drop column`, `truncate`, `delete` auf bestehende Daten. Umbenennen nur mit Rückfrage.
- Nach jedem Umzug: Zeilenzahlen pro Tabelle alt vs. neu vergleichen und als Tabelle berichten. Bei Abweichung stoppen.
- Alte Supabase-Projekte und Vercel-Apps nur pausieren bzw. umleiten, nie löschen.

## Phase 1: Zugänge-Verwaltung

1. **App-Register erweitern** (`lib/apps.ts`):
   - `warenbestand`: bleibt vorerst `kachel` (externe App), später Modul.
   - `projekte` (nic), Titel „Projekte“, `enforcement: "intern"`, `live: false`. Die Kachel nur anzeigen, wenn live.
   - `pandacad`, Titel „PandaCAD“, `enforcement: "intern"`, `live: true`.
   - Prüfen, ob `hoellental` noch gebraucht wird (Kachel wurde entfernt). Falls nicht, aus dem Register nehmen, Daten in `app_access` bleiben unschädlich.
2. **Neue Seite `/mitarbeiter/zugaenge`** (nur CEO/Admin):
   - Tabelle: Zeilen = aktive Mitarbeiter, Spalten = Apps aus `APPS`, Zellen = Checkbox.
   - Ein Klick speichert sofort per Server Action (optimistisch, bei Fehler zurücksetzen und Meldung anzeigen).
   - CEO/Admin-Zeilen: alle Haken gesetzt und gesperrt (Hinweis „Admin hat immer Zugriff“).
   - Spalten-Kopf: „alle an/aus“ pro App. Zeilen-Ende: „alle an/aus“ pro Mitarbeiter.
   - Mobil: horizontal scrollbar, erste Spalte fixiert.
   - Link zur Seite in der Mitarbeiter-Übersicht.
3. **Einladen und Deaktivieren:**
   - Beim Anlegen eines Mitarbeiters mit E-Mail: Einladung über Supabase Auth Admin (`inviteUserByEmail`, serverseitig mit Service-Role-Key, Redirect auf `/passwort-neu`). Erst prüfen, wie Mitarbeiter und Auth-User heute verknüpft sind (`employee_sync`-Migration), und das Muster übernehmen.
   - „Deaktivieren“ statt Löschen: Flag am Mitarbeiter (prüfen, ob es schon eins gibt), Login sperren (Auth-User bannen), aus der Matrix ausblenden. Reaktivieren muss möglich sein.
4. `docs/ZUGAENGE.md` aktualisieren.

## Phase 2: PandaCAD-Installationsseite

Route `/pandacad`, geschützt mit `requireAppAccess("pandacad")`. Kachel im Hub.
Zielgruppe: Windows-PCs im Büro. Palette CAD (mit Holztechnik/PaletteCAM), Version laut Team 10.52.

**Inhalt der Seite** (Schritte als nummerierte Karten, jeweils mit Checkbox „erledigt“, Fortschritt nur lokal im Browser speichern):
1. Voraussetzungen: Windows-PC, Netzlaufwerk `R:` verbunden, Admin-Rechte zum Installieren.
2. Installation: `R:\Palette CAD\Installationsdateien\PaletteShowroomSetupDEU.exe` ausführen. Pfad mit Kopier-Button. Kein Browser-Download, die Datei hat 912 MB.
3. Update: `R:\Palette CAD\Installationsdateien\paletteCAD1010UpdateDEU64.exe` ausführen (672 MB, ebenfalls nur Pfad + Kopier-Button). Hinweis auf den Updatemanager (PDF-Anleitung).
4. Lizenz und Login: PLATZHALTER „Wird von Noah ergänzt“. Keine Zugangsdaten auf die Seite.
5. Pfade einrichten: `Pfade für PaletteCAD.pcadconfig` herunterladen und in Palette CAD importieren. Die Datei setzt alle Datenpfade auf `R:\Palette CAD\Dat\…` (Bom, Styles, Frames usw.). Import-Schritte in Palette CAD: PLATZHALTER, von Noah bestätigen lassen.
6. Grabner-Design-Standards (Materialien/Objekte): PLATZHALTER, Ablage auf R: von Noah bestätigen lassen.
7. Test: Testprojekt öffnen, Bibliothek „GD Korpus“ sichtbar.

**Downloads-Bereich:**
- Privater Supabase-Storage-Bucket `pandacad`. Download per Server Action mit kurzlebiger Signed URL, nur nach `has_app_access('pandacad')`. RLS-Policy für `storage.objects` passend dazu.
- Dateien (liegen auf dem Mac unter `/Users/edmundlaabs/KG/_SHARED/Programmierung/Prgrammierung/PandaCAD/Palette CAD/`):
  - `Pfade für PaletteCAD.pcadconfig`
  - `Anleitungen/Updatemanageranleitung.pdf`
  - `Anleitungen/Home_Pro_Erste_Schritte.pdf`
  - `Anleitungen/Palette_Showroom-Erste_Schritte.pdf`
  - `Anleitungen/Palette_Showroom_PRO.pdf`
  - `Anleitungen/PaletteCAD-Online Browser.pdf`
  - `Anleitungen/E-Learning-Anmeldung.pdf`
- NICHT hochladen: `Palette CAD - Login und Lizenzen.*`, `Benutzerprofil_*.pcadUI` (persönlich), `.msg`, `Thumbs.db`, Installer.
- Liste der Downloads aus einer Tabelle `pandacad_downloads` (titel, beschreibung, storage_path, reihenfolge) mit RLS über `has_app_access('pandacad')`, damit später ohne Code neue Dateien dazukommen. Upload-Skript `supabase/upload-pandacad-files.mjs` (Probelauf + `--write`) anlegen, nicht ausführen.

**Hinweis für mich auf der Seite** (nur für Admin sichtbar): Die pcadconfig nennt Version 10.18.051, im Einsatz ist 10.52. Bitte prüfen, ob die Datei noch aktuell ist.

## Inhalt für `docs/PLAN-ZUSAMMENFUEHRUNG.md`
- Module: /gerda (Daten schon in gerda_*), /warenbestand (Daten aus Supabase-Projekt `warenbestand-werk-2` ifgkbhtmupnwupttagpr: products, reservations, stock_movements, app_users → Tabellen `lager_*`, app_users auf employees mappen; UI aus GitHub-Repo, Name offen), /projekte (nic, Projekt `tfqoeornzjblyvaussow`, pausiert: users_v2, projects_v2, tasks, project_files + Bucket project-files, notifications, feedback_v2 → `projekte_*`), /pandacad, /urlaub.
- Pro Modul: Layout-Guard + RLS `has_app_access`, Tabellen-Präfix, alte Vercel-Domain leitet weiter, altes Supabase-Projekt danach pausieren.
- Reihenfolge: 1 Zugänge, 2 PandaCAD, 3 Gerda, 4 Warenbestand, 5 nic, 6 Urlaub, 7 Altes abschalten.

## Abschluss
Kurzer Bericht: geänderte Dateien, neue Migrationen (nicht ausgeführt), was ich in Supabase/Vercel tun muss (Env-Variablen, Redirect-URLs, Bucket), offene Platzhalter.
