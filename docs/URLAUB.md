# Urlaub & Abwesenheit (`/urlaub`)

Stand: 18.11.2026 · Branch `feature/urlaub` · Migration `supabase/migrations/20261118_urlaub.sql` (noch nicht ausgeführt) · Kachel `live: false`.

## Rollen
- **Mitarbeiter** mit Freischaltung „Urlaub“ (`employees.app_access`): eigene Anträge, eigenes Konto, Kalender.
- **CEO/Admin** (`app_role()` in `ceo`, `admin`, gleichberechtigt): sehen und entscheiden alles, pflegen Konten und Einstellungen (`/urlaub/verwaltung/…`).

## Datenmodell (alle Tabellen mit RLS)
| Tabelle | Inhalt |
|---|---|
| `urlaub_antraege` | Antrag: Art (`urlaub`, `ueberstunden`, `sonder`, `krank`), `von`/`bis`, `halbtag_start`/`halbtag_ende`, `tage` (serverseitig berechnet), Status, Kommentar, Entscheidung (`entschieden_von/am`, `begruendung`) |
| `urlaub_kontingente` | je Mitarbeiter und Jahr: `anspruch`, `uebertrag`, `uebertrag_verfall` (Standard 31.03.), `korrektur` + Notiz |
| `urlaub_arbeitsmuster` | Arbeitstage Mo–So ab `gueltig_ab`; ohne Eintrag gilt Mo–Fr |
| `urlaub_konfliktpaare` | zwei Mitarbeiter, die nie gleichzeitig weg sein sollen (nur Admin sichtbar) |
| `urlaub_sperren` | Zeiträume mit Titel (z. B. Messe) |
| `urlaub_betriebsferien` | Zeitraum, Titel, `zaehlt_als_urlaub` |
| `urlaub_protokoll` | jede Statusänderung (wird per Trigger geschrieben) |

Dazu: `urlaub_my_employee_id()`, `urlaub_is_admin()` und `urlaub_team_kalender(von, bis)` (Kollegen: nur Name, Zeitraum, Halbtage, Status; keine Art, kein Kommentar, keine fremden Krankmeldungen).

## Schreibwege und Absicherung
- **Neuer Antrag:** nur über die Server Action. Sie prüft Zugriff, berechnet `tage` aus Arbeitsmuster/Feiertagen/Betriebsferien und schreibt mit dem Service-Role-Key. Mitarbeiter haben **keine** INSERT-Policy.
- **Zurückziehen / Storno beantragen:** eigener Antrag per RLS-UPDATE; ein Trigger erlaubt genau diese Wechsel (`beantragt → zurueckgezogen`, `genehmigt → storno_beantragt`).
- **Genehmigen / Ablehnen / Stornieren:** nur CEO/Admin. Der Trigger `urlaub_antraege_guard` erzwingt das auch bei direktem DB-Zugriff, verlangt beim Ablehnen eine Begründung und setzt `entschieden_von/am`.
- Zeitraum, Art, Halbtage und `tage` sind nach dem Anlegen unveränderlich.

## Statusablauf
`beantragt → genehmigt | abgelehnt (Begründung Pflicht)` · `beantragt → zurueckgezogen` (Mitarbeiter) · `genehmigt → storno_beantragt → storniert | genehmigt` (Admin bestätigt oder lehnt ab). Admin kann einen genehmigten Antrag auch direkt stornieren.

## Berechnung (`lib/urlaub/`, mit Tests: `npm test`)
- **Arbeitstage:** nur Tage laut Arbeitsmuster; Feiertage Baden-Württemberg zählen nicht (Neujahr, Hl. Drei Könige, Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, 3. Okt., Allerheiligen, 25./26.12.; per Osterformel berechnet). 24.12. und 31.12. zählen als Arbeitstag nur 0,5 (ein Halbtag-Haken senkt nicht weiter). Halbtag am Anfang/Ende = 0,5; eintägig mit Halbtag = 0,5.
- **Betriebsferien:** ohne „zählt als Urlaub“ zählen die Tage nicht. Mit dem Schalter werden die Arbeitstage jedes Mitarbeiters automatisch vom Konto abgezogen (berechnet, keine Buchungszeilen). Liegt eigener Urlaub in den Betriebsferien, zählt jeder Tag nur einmal.
- **Konto:** nur Art `urlaub` zählt. `genommen` = genehmigt bis einschließlich heute, `geplant` = genehmigt danach, `beantragt` = offen. Rest = Anspruch + Übertrag (ohne Verfallenes) + Korrektur − genommen − geplant. Anträge über den Jahreswechsel zählen je Jahr (live aus `von`/`bis`).
- **Übertrag/Verfall:** Urlaub bis zum Verfallsdatum geht zuerst vom Übertrag ab; was am Stichtag übrig ist, verfällt. „Übertrag aus Vorjahr“ (Konten) übernimmt den Rest des Vorjahres zum 31.12. (nie negativ) als Vorschlag ins Konto.
- **Konflikte** (nur Hinweis, blockieren nie): überschneidende aktive Anträge eines Konfliktpartners und Urlaubssperren. Admin sieht sie im Eingang (Badges) und im Teamkalender (rot). Mitarbeiter sehen nur beim Beantragen den Hinweis zur Sperre.
- Ein Antrag darf sich nicht mit einem eigenen aktiven Antrag überschneiden (wird abgelehnt) und braucht mindestens einen Arbeitstag.

## Oberfläche
- `/urlaub`: Resturlaub groß, Kontoübersicht, Formular (Live-Anzeige „X Arbeitstage“, Hinweise zu Feiertagen/Betriebsferien/Sperre), Jahreskalender (Handy: ein Monat; Filter „nur ich / alle“), „Meine Anträge“. Krankmeldung ist ein ausgegrauter Button.
- `/urlaub/verwaltung`: Eingang · `/team` Teamkalender (Monat) · `/konten` · `/einstellungen` (Betriebsferien, Sperren, Konfliktpaare, Arbeitsmuster) · `/antrag/[id]` Detail mit Protokoll.
- Startseite: Widget mit Resturlaub, offenen Anträgen, nächster Abwesenheit; Admin/CEO zusätzlich Zähler offener Anträge. Erscheint erst, wenn `urlaub` in `lib/apps.ts` auf `live: true` steht.
- Benachrichtigungen: noch keine Mails. `lib/urlaub/notify.ts` ist die eine Stelle für einen späteren Versand (Resend).

## Ersteinrichtung
1. Backup nach `../Backup/schlutte_<JJJJ-MM-TT_HHMM>/` (Struktur + Daten), dann `20261118_urlaub.sql` im SQL-Editor ausführen.
2. Unter *Admin → Zugänge* „Urlaub“ für die Mitarbeiter freischalten.
3. *Urlaub → Konten*: je Mitarbeiter Anspruch und Resturlaub 2026 (als Übertrag oder Korrektur mit Notiz) eintragen.
4. *Einstellungen*: Betriebsferien, Sperren, Konfliktpaare (z. B. Nic + Noah) und abweichende Arbeitsmuster anlegen.
5. Erst danach `live: true` setzen.

## Später
Krankmeldung (Art `krank` ist in der DB vorgesehen), Resend-Mails, Outlook-Sync, Vertretung, Homeoffice.
