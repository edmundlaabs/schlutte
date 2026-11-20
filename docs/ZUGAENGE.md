# Zugänge, App-Berechtigungen, Passwort-Recovery und Gerda-Umzug

Stand: 17.11.2026. Die Schlutte ist die zentrale Plattform: ein Login, eine Datenbank
(Supabase), eine Rechteverwaltung für alle Apps.

## Konzept

- **Identität** = Schlutte-Login (Supabase Auth, E-Mail + Passwort). Verknüpfung zum
  Mitarbeiter-Datensatz über die E-Mail.
- **App-Berechtigungen**: pro Mitarbeiter ein Schalter je App (= Kachel im Hub), Spalte
  `employees.app_access` (text[]). Vergabe unter *Mitarbeiter → Bearbeiten*. CEO und Admin
  haben immer alle Apps. App-Register: `lib/apps.ts`.
- **Durchsetzung** je nach App:
  | App | Art | Wirkung |
  |---|---|---|
  | Druckvorlagen Werkstatt, Bestellliste, Auslagen & Belege | intern | Kachel weg + Seiten serverseitig gesperrt (`requireAppAccess`) |
  | Gerda | intern + Datenbank | Modul unter `/gerda` (Layout-Guard `requireAppAccess('gerda')`), zusätzlich RLS auf den `gerda_*`-Tabellen (`public.has_app_access('gerda')`) |
  | PandaCAD | intern | Kachel weg + `/pandacad` serverseitig gesperrt; Downloads über Signed URLs, Storage-RLS mit `has_app_access('pandacad')` |
  | Abnahme | intern + Datenbank | `/abnahme` (Layout-Guard `requireAppAccess('abnahme')`), RLS auf allen `abnahme_*`-Tabellen und Storage-Bucket `abnahme` über `has_app_access('abnahme')`; bestehende Mitarbeiter bekommen den Zugang nicht automatisch |
  | Projekte (nic) | intern, noch nicht live | Kachel erst sichtbar, wenn `live: true` in `lib/apps.ts` |
  | Warenbestand WERK 2 | nur Kachel | Kachel weg — die App selbst prüft (noch) nichts, die URL bleibt direkt erreichbar |
  | Druckvorlagen Personal, Urlaubsantrag | folgt | vorab vergebbar |
- **Passwort global**: Es gibt nur noch ein Passwort (Supabase). Zurücksetzen per
  Selbstservice (`/passwort-vergessen` → E-Mail-Link → `/passwort-neu`) oder durch den Admin
  in der Mitarbeiterverwaltung. Gerdas Login-Seite verlinkt auf `/passwort-vergessen`.
- **Gerda** (Repo `ppl`, Ordner `antigravity-list`) bleibt eine eigene App unter eigener
  Domain, nutzt aber Login und Datenbank der Schlutte. Firebase entfällt komplett.
  Nächster Ausbauschritt: Gerda als Modul in die Schlutte holen.

## Zugänge-Matrix, Einladen, Deaktivieren

- **Matrix**: *Mitarbeiter → Zugänge (App-Matrix)* (`/mitarbeiter/zugaenge`, nur CEO/Admin). Zeilen = aktive
  Mitarbeiter, Spalten = Apps. Jeder Klick speichert sofort; bei Fehler springt der Haken zurück und eine Meldung
  erscheint. „alle an/aus“ je App und je Mitarbeiter. Admin-Zeilen sind gesperrt (Admin hat immer Zugriff).
- **Einladen**: Neuer Mitarbeiter mit E-Mail, aktiv und ohne Passwort → Einladungsmail (`inviteUserByEmail`,
  Link auf `/passwort-neu`). Mit Passwort wird wie bisher direkt ein Login angelegt.
  Verknüpfung Mitarbeiter ↔ Login bleibt die E-Mail.
- **Deaktivieren**: `employees.is_active = false` sperrt zusätzlich den Login (Auth-Ban) und blendet den Mitarbeiter aus
  der Matrix aus. Reaktivieren hebt den Ban auf. Bereits ausgestellte Sitzungen laufen bis zum Ablauf des Tokens.

## Einrichtung und Umzug (in dieser Reihenfolge)

1. **Datenbank**: im Supabase SQL-Editor nacheinander ausführen
   - `supabase/migrations/20261116_app_access.sql` (Berechtigungen; bestehende Mitarbeiter
     behalten zunächst alle Apps, neue starten ohne),
   - `supabase/migrations/20261117_gerda_tables.sql` (Gerda-Tabellen, RLS, Realtime).
2. **Supabase Redirect-URL**: Authentication → URL Configuration → Redirect URLs:
   `https://schlutte.vercel.app/passwort-neu` (und `http://localhost:3000/passwort-neu`).
3. **Supabase E-Mail-Versand**: Der eingebaute Versand ist stark limitiert — für den Betrieb
   eigenen SMTP eintragen (Authentication → Emails → SMTP). Empfohlen: Vorlage
   *Reset Password* auf `{{ .SiteURL }}/passwort-neu?token_hash={{ .TokenHash }}&type=recovery`
   umstellen, dann funktioniert der Link auf jedem Gerät (Standard-Link nur im Browser,
   in dem er angefordert wurde).
4. **Schlutte deployen** (commit + push).
5. **Logins prüfen**: Jeder Gerda-Nutzer braucht einen Mitarbeiter-Datensatz mit E-Mail,
   einen Schlutte-Login und die Freischaltung „Gerda“. Firebase-Passwörter werden nicht
   übernommen.
6. **Daten umziehen** (auf dem Mac, im Ordner `schlutte_develop`):
   Service-Account-Schlüssel des Gerda-Firebase-Projekts laden (Firebase Console →
   Projekteinstellungen → Dienstkonten → *Neuen privaten Schlüssel generieren*), dann
   ```
   node supabase/migrate-gerda-from-firebase.mjs ~/Downloads/schluessel.json          # Probelauf
   node supabase/migrate-gerda-from-firebase.mjs ~/Downloads/schluessel.json --write  # übernehmen
   ```
   Der Probelauf liest nur und schreibt ein JSON-Backup neben die Repos. `--write` ist
   wiederholbar. Schlüsseldatei danach löschen.
7. **Gerda umstellen**: in Vercel (Projekt `ppl`) `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_ANON_KEY` setzen (gleiche Werte wie `NEXT_PUBLIC_SUPABASE_*` der
   Schlutte), dann Gerda deployen. Ab diesem Moment schreibt Gerda nach Supabase.
   Damit keine Einträge verloren gehen: Schritt 6 (`--write`) unmittelbar vor dem
   Deploy noch einmal ausführen und in der Zwischenzeit nichts in Gerda ändern.
8. **Aufräumen**, wenn alles läuft: Firebase-Projekt stilllegen, `firebase` aus Gerdas
   `package.json` entfernen, `VITE_FIREBASE_*` in Vercel löschen.

## Grenzen

- Der Schutz interner Schlutte-Apps greift auf Seitenebene (Layouts), nicht in den
  RLS-Policies der jeweiligen Tabellen. Gerda ist per RLS geschützt.
- Warenbestand WERK 2 braucht eine eigene Anbindung, damit die
  Berechtigung dort wirklich durchgesetzt wird.
- „Inaktiv“ sperrt den Login per Ban (Service-Role-Key nötig); laufende Sitzungen enden erst mit dem Token.
- Gerda und Schlutte liegen auf verschiedenen Domains: gleiches Passwort, aber getrennte
  Anmeldung, bis Gerda ein Modul der Schlutte ist.

## Gerda als Modul (/gerda)

Gerda läuft jetzt in der Schlutte unter `/gerda` (Code: `app/gerda/`, aus der Vite-App `antigravity-list`
übernommen; gleiche Sitzung, kein zweites Login). Styles: Tailwind v4 nur für diese Route
(`app/gerda/gerda.css`, ohne Preflight). Die alte Domain `ppl-two.vercel.app` bleibt unverändert bestehen;
Weiterleitung auf `/gerda` und Abschalten folgen nach dem Test.
