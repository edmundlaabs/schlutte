# Prompt: Schlutte V1.0 – Release-Popup + rote Punkte für Eingänge

Lies zuerst AGENTS.md (Next.js 16 mit Breaking Changes – Doku in node_modules/next/dist/docs/ prüfen) sowie lib/version.ts, lib/changelog.ts, lib/apps.ts, components/shell/*, app/(app)/page.tsx, lib/data/auslagen-inbox.ts, lib/urlaub/*, app/(app)/admin/*. Plane zuerst, zeig mir den Plan, dann umsetzen. Keine Daten löschen, alle Migrationen additiv und idempotent (if not exists).

## Teil 1 – Version 1.0

1. `lib/version.ts`: APP_VERSION = "1.0.0". `package.json` version ebenfalls "1.0.0".
2. `lib/changelog.ts`: neuen Eintrag 1.0.0 (Datum: Tag des Deploys, Format TT.MM.JJJJ) oben einfügen. Die Einträge 0.1.0–0.5.0 bleiben als Historie erhalten (Feedback-Seite zeigt sie weiter).
   Erweitere den Typ um optionales `highlights?: { title: string; text: string }[]` – das Popup nutzt highlights, die Feedback-Seite weiter changes.
3. Inhalt V1.0 (Texte so übernehmen, Du-Form):

   Titel: „Willkommen in der Schlutte 1.0“
   Intro: „Die Schlutte ist jetzt unsere gemeinsame Firmen-App – alles an einem Ort, mit einem Login.“

   highlights:
   - **Ein Login für alles** – Anmeldung über Supabase, Passwort selbst zurücksetzen per E-Mail. Welche Apps du siehst, legt der Admin fest.
   - **Neue Startseite** – Apps in drei Gruppen (Werkstatt & Lager, Büro & Personal, Planung & Tools), dazu „Zu erledigen“, Termine und Geburtstage.
   - **Einheitliche Navigation** – Logo, App-Wechsler, Breadcrumb und Avatar-Menü oben, darunter die Tabs der App; auf dem Handy als Tab-Leiste unten.
   - **Werkstatt** – Kommissionen anlegen, bearbeiten, durchsuchen, archivieren; Palettenlabels (intern und Versand, mehrere pro Kommission) erstellen und drucken.
   - **Druckvorlagen** – neue Vorlage „Auftragsoberfläche (Muster)“: A5-Labels geölt/gebeizt/lackiert, beliebige Anzahl, 2 pro A4-Blatt, Live-Vorschau.
   - **Urlaub (neu)** – Urlaub, Überstundenabbau und Sonderurlaub beantragen, auch halbe Tage; Resturlaub und Kalender mit Feiertagen BW, Betriebsferien und Urlaubssperren.
   - **Auslagen** – Belege erfassen und als Antrag einreichen.
   - **Gerda und PandaCAD** – Gerda läuft jetzt in der Schlutte; PandaCAD-Installation mit Downloads für die Büro-PCs.
   - **Schlutte aufs Handy** – im Avatar-Menü „Als App“ zeigt die passende Anleitung für iPhone, Android oder Computer.
   - **Feedback** – Fehler oder Wünsche jederzeit über den Feedback-Button oben melden.

   changes (für die Feedback-Seite, kompakt): Zusammenfassung von 0.1.0–0.5.0 + „Admin/CEO: rote Punkte für offene Eingänge (Urlaub, Auslagen, Feedback, Registrierungen)“ + „Auslagen: Anträge können als erledigt markiert werden“ + „Hinweisfenster zu neuen Versionen“.

   Admin/CEO sehen im Popup zusätzlich einen Block „Für Admin/CEO“: Mitarbeiter, Zugänge und Feedback-Eingang im Admin-Bereich; Urlaubs-Eingang mit Genehmigen/Ablehnen, Teamkalender mit Konflikten, Konten; Auslagen-Eingang und Abgleich; neue rote Punkte zeigen offene Vorgänge.

## Teil 2 – Release-Popup („Was ist neu“)

- Migration `supabase/migrations/YYYYMMDD_release_notes_seen.sql`: Spalte `employees.last_seen_version text null`. RLS: Mitarbeiter darf nur die eigene Zeile und nur diese Spalte setzen (Server Action mit Prüfung, kein freies Update). Bestehende Write-Guards auf employees beachten (20260925_auslagen_employees_write_guard.sql).
- Logik: Nach Login im (app)-Layout serverseitig `last_seen_version` lesen. Ist sie null oder < APP_VERSION (semver-Vergleich, eigene kleine Funktion in lib/utils.ts) → Popup anzeigen. Gilt für alle Rollen, einmal pro Version. Künftige Versionen lösen das Popup automatisch erneut aus, sofern der Changelog-Eintrag `highlights` hat (ohne highlights → still auf neue Version setzen, kein Popup).
- Schließen („Verstanden“, X, Esc, Klick außerhalb) → Server Action setzt `last_seen_version = APP_VERSION`. Optimistisch sofort schließen.
- Nicht auf /app, /login, /registrieren, /passwort-*, /print* anzeigen.
- Kein localStorage als Quelle der Wahrheit (geräteübergreifend).
- Gestaltung: bestehende Tokens aus styles/tokens.css, Schrift wie im Rest der App, mobil als Fullscreen-Sheet mit scrollbarem Inhalt, Desktop zentriertes Modal max. ~560px. Fokus-Falle, aria-modal, Rollenblock nur für ceo/admin. Darf nicht mit dem Install-Hinweis (lib/install.ts) kollidieren: Wenn Popup offen ist, Install-Hinweis erst danach zeigen.
- Link im Popup „Alle Änderungen ansehen“ → Feedback-Seite.

## Teil 3 – Rote Punkte für offene Eingänge (nur ceo/admin)

Quellen und Bedingung „offen“ (Punkt erlischt, sobald nichts mehr offen ist – status-basiert, gilt für alle Admins gemeinsam):

| Quelle | offen wenn | erledigt durch | Ziel-Tab |
|---|---|---|---|
| Urlaub | urlaub_antraege.status in ('beantragt','storno_beantragt') | Genehmigen / Ablehnen / Storno entscheiden | /urlaub/verwaltung (Eingang) |
| Auslagen | expense_claims.status = 'versendet' (nicht vom Admin selbst) | neuer Status 'erledigt' | /auslagen/eingang |
| Feedback | feedback.status = 'offen' | Status ändern | /admin/feedback |
| Registrierungen | employees.pending_approval = true | Freigeben / Ablehnen | /admin/mitarbeiter |

Auslagen-Erweiterung:
- Migration: Check-Constraint von expense_claims.status um 'erledigt' erweitern; Spalten `done_at timestamptz`, `done_by uuid`. Übergang nur versendet → erledigt, nur ceo/admin (Trigger wie bei Urlaub). Alle bestehenden Checks/Policies, die auf status = 'versendet' prüfen (pdf_path-Check, Storage-Policy, receipts-Policies in 20260925_* und 20261118_receipt_visibility.sql), so anpassen, dass sie auch 'erledigt' erlauben – sonst verlieren Admins und Mitarbeiter den Zugriff auf erledigte Anträge. Jede Stelle einzeln prüfen und im Plan auflisten.
- UI Auslagen-Eingang: Button „Als erledigt markieren“ (mit Rückgängig innerhalb der Sitzung → zurück auf versendet, nur Admin), Filter Offen/Erledigt, erledigte ausgegraut. Mitarbeiter sehen in „Anträge“ den Status „erledigt“.
- Der bestehende pro-Admin-Gelesen-Status (expense_claim_reads) bleibt für die Fettschrift „ungelesen“, steuert aber nicht den roten Punkt.

Zähl-Logik:
- Eine Server-Funktion `lib/data/inbox-counts.ts` → `getInboxCounts(): { urlaub, auslagen, feedback, registrierungen }`, nur für ceo/admin (sonst alles 0, keine Query). Count-Queries mit `head: true, count: 'exact'`. Optional eine Postgres-Function `inbox_counts()` security definer mit Rollenprüfung, falls RLS die Counts verhindert.
- Im (app)-Layout einmal laden und per Context an die Shell geben. Aktualisierung: nach jeder Erledigt-Action `revalidatePath`, zusätzlich Supabase Realtime oder Polling alle 60 s, wenn das Fenster sichtbar ist (bevorzuge das Einfachere, begründe kurz).

Anzeige (Punkt mit Zahl, ab 10 „9+“):
- Startseite: Kachel der App (Urlaub, Auslagen) und „Zu erledigen“-Bereich mit Einträgen pro Quelle.
- App-Wechsler: an der jeweiligen App.
- SubNav: am Tab „Eingang“ (Urlaub, Auslagen); in apps.ts ein Feld `badge?: 'urlaub' | 'auslagen' | 'feedback' | 'registrierungen'` an den Nav-Items ergänzen statt Pfade hart zu verdrahten.
- Admin-Menü/Avatar-Menü: Summe Feedback + Registrierungen am Admin-Eintrag, einzeln an „Feedback“ und „Mitarbeiter“.
- Mobil-Tab-Leiste: gleiche Badges.
- Eine Komponente `components/ui/Badge.tsx` (rot aus tokens.css, mind. 16px, aria-label „3 offene Urlaubsanträge“). Kein Badge bei 0.
- Die bisherige Zahl offener Urlaubsanträge auf der Startseite (0.5.0) auf die neue Komponente umstellen, nicht doppelt anzeigen.

## Abschluss
- `npm run build`, `npm run lint`, `npm test` grün. Tests für semver-Vergleich und inbox-Counts-Mapping ergänzen.
- Manuell prüfen mit einem Mitarbeiter- und einem Admin-Konto: Popup erscheint einmal, nach Schließen nicht mehr (auch auf anderem Gerät); Badge erscheint bei neuem Antrag und verschwindet nach Erledigen.
- Migrationen nicht selbst auf Produktion ausführen – mir die Reihenfolge nennen.
- Kurze Zusammenfassung der geänderten Dateien.
