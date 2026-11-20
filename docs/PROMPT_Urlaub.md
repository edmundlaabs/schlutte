# Auftrag: Schlutte – Modul Urlaub & Abwesenheit (/urlaub)

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase, Repo github.com/edmundlaabs/schlutte).
Supabase-Projekt: `schlutte` (ID `jxbsymuaifwnltogizwf`).

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16: Doku in `node_modules/next/dist/docs/` beachten), `DECISIONS.md`, `docs/ZUGAENGE.md`, `docs/PLAN-ZUSAMMENFUEHRUNG.md`
2. `lib/apps.ts` – Kachel `urlaub` existiert (`enforcement: "intern"`, `live: false`, Gruppe `buero-personal`)
3. `lib/auth/app-access.ts` (`requireAppAccess`), `lib/auth/app-role.ts` (`hasAdminRights`), `lib/auth/roles.ts` (`getCurrentUserContext`)
4. DB-Funktionen `public.app_role()` (Migration `20260925_auslagen.sql`) und `public.has_app_access(text)` (Migration `20261117_gerda_tables.sql`)
5. Ein bestehendes internes Modul als Vorlage, z. B. `app/(app)/auslagen/` und `app/(app)/bestellliste/` (Layout-Guard, Server Actions, Styles)
6. `app/(app)/page.tsx` (Startseite/Hub, dort kommt das Widget hin)

## Arbeitsregeln
- Erst einen Plan schreiben (Dateien, Migrationen, Komponenten, Risiken) und mir zeigen. Bauen erst nach meinem OK.
- Eigener Branch `feature/urlaub`. Nichts auf main pushen, nichts deployen.
- Migrationen nur als Datei in `supabase/migrations/` (Name `2026MMDD_urlaub.sql`). Gegen die Live-DB erst nach meinem OK ausführen.
- Vor dem Ausführen einer Migration: Backup nach `../Backup/schlutte_<JJJJ-MM-TT_HHMM>/` (Struktur + Daten). Migration nur additiv, keine bestehenden Tabellen/Spalten ändern oder löschen.
- Bestehende Muster und Styles nutzen (`styles/intranet.css`, `components/ui`, `components/intranet`). Keine neuen Libraries ohne Rückfrage (Kalender selbst bauen).
- Alle Texte auf Deutsch. Mobil nutzbar (Mitarbeiter-Ansicht vor allem auf dem Handy).
- Am Ende `npm run lint` und `npx tsc --noEmit`, Fehler selbst beheben. Die Tageberechnung mit Tests absichern (siehe unten).
- Unklar → nachfragen statt raten.

## Rollen
- Mitarbeiter: braucht `app_access` für `urlaub`.
- Admin/CEO (`app_role()` in ('ceo','admin')): sehen und entscheiden alles, pflegen Einstellungen. Beide gleichberechtigt.

## Fachliche Regeln
- **Antragsarten:** `urlaub`, `ueberstunden` (Überstundenabbau), `sonder` (Sonderurlaub), `krank`.
  - Nur `urlaub` zählt gegen das Urlaubskonto. `ueberstunden` und `sonder` brauchen Genehmigung, zählen aber nicht gegen das Konto.
  - `krank`: in der DB vorsehen, in der Oberfläche als ausgegrauter, inaktiver Button „Krankmeldung – kommt später“. Keine Uploads, kein Bucket.
- **Halbe Tage:** Antrag hat `halbtag_start` und `halbtag_ende` (bool). Ein eintägiger Antrag mit halbem Tag = 0,5.
- **Arbeitstage-Berechnung** (eine reine Funktion in `lib/urlaub/`, mit Tests):
  - Zählt nur Tage, an denen der Mitarbeiter laut Arbeitsmuster arbeitet (Standard Mo–Fr).
  - Feiertage Baden-Württemberg zählen nicht: Neujahr, Hl. Drei Könige (6.1.), Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, 3. Okt., Allerheiligen (1.11.), 25. und 26.12. Berechnung im Code über Osterformel, keine Tabelle.
  - 24.12. und 31.12. zählen, wenn Arbeitstag, nur als halber Tag.
  - Betriebsferien: wenn `zaehlt_als_urlaub = false`, zählen die Tage nicht; wenn `true`, zählen sie gegen das Konto (siehe unten).
- **Betriebsferien:** Admin legt Zeitraum + Titel an, Schalter „Mitarbeiter müssen dafür Urlaub nehmen“ (`zaehlt_als_urlaub`). Bei `true` werden die Tage automatisch vom Konto jedes Mitarbeiters abgezogen (als berechnete Buchung, kein manueller Antrag nötig). Im Kalender für alle sichtbar.
- **Urlaubskonto pro Mitarbeiter und Jahr:**
  - `anspruch` (individuell, vom Admin gepflegt), `uebertrag` aus Vorjahr, `korrektur` (± manuell mit Notiz).
  - Übertrag automatisch = Rest des Vorjahres; nicht genommener Übertrag verfällt am 31.03. (Datum pro Konto änderbar).
  - Anzeige: Anspruch, Übertrag (mit Verfallsdatum), genommen (genehmigt, Datum vergangen), geplant (genehmigt, zukünftig), beantragt (offen), Rest.
  - Zum Start trägt der Admin Anspruch und Resturlaub 2026 je Mitarbeiter von Hand ein.
- **Status-Ablauf:** `beantragt` → `genehmigt` | `abgelehnt` (Begründung Pflicht); Mitarbeiter kann `beantragt` → `zurueckgezogen`; bei genehmigt nur `storno_beantragt` → Admin bestätigt `storniert` oder lehnt ab (zurück auf `genehmigt`).
- **Konflikte** (nur Hinweis, blockieren nie):
  - Konfliktpaare: zwei Mitarbeiter, die nie gleichzeitig weg sein dürfen (z. B. Nic + Noah). Konflikt, wenn sich beantragte/genehmigte Zeiträume überschneiden.
  - Urlaubssperren: Zeiträume mit Titel (z. B. Messe). Konflikt, wenn ein Antrag hineinfällt.
  - Admin sieht Konflikt im Eingang und im Teamkalender (rot), kann trotzdem genehmigen. Mitarbeiter sieht beim Beantragen einen neutralen Hinweis bei Sperre („In diesem Zeitraum ist eine Urlaubssperre: Messe“), aber keine Konfliktpaare.
- **Benachrichtigung:** vorerst keine Mails. Admin/CEO sehen auf der Startseite einen Zähler offener Anträge. Code so anlegen, dass später ein Mailversand (Resend) an einer Stelle eingehängt werden kann (z. B. `lib/urlaub/notify.ts` als leere Funktion mit TODO).

## Datenmodell (Präfix `urlaub_`, RLS auf allen Tabellen)
- `urlaub_antraege`: id, employee_id → employees, art, von (date), bis (date), halbtag_start, halbtag_ende, tage (numeric, serverseitig berechnet), status, kommentar, entschieden_von, entschieden_am, begruendung, created_at, updated_at. Check `bis >= von`.
- `urlaub_kontingente`: employee_id, jahr, anspruch, uebertrag, uebertrag_verfall (default 31.03. des Jahres), korrektur, korrektur_notiz. Unique (employee_id, jahr).
- `urlaub_arbeitsmuster`: employee_id, gueltig_ab, mo, di, mi, do, fr, sa, so (bool). Fehlt ein Eintrag → Mo–Fr.
- `urlaub_konfliktpaare`: id, employee_a, employee_b (a < b, unique).
- `urlaub_sperren`: id, von, bis, titel.
- `urlaub_betriebsferien`: id, von, bis, titel, zaehlt_als_urlaub (bool).
- `urlaub_protokoll`: id, antrag_id, aktion, von_employee, notiz, created_at (jede Statusänderung).
- **RLS:**
  - Mitarbeiter mit `has_app_access('urlaub')`: eigene Anträge lesen/anlegen; nur eigene im Status `beantragt` zurückziehen bzw. bei `genehmigt` Storno beantragen. Status-Wechsel auf genehmigt/abgelehnt/storniert nur Admin/CEO (per Trigger oder Policy absichern, nicht nur im UI).
  - Kollegen-Abwesenheiten über eine View/Funktion `urlaub_team_kalender`: nur Name, von, bis, halbtag-Flags, Status (`beantragt`/`genehmigt`). Art wird bei Kollegen nur als „abwesend“ gezeigt; Kommentar/Begründung nie.
  - Eigenes Konto lesen; Konten anderer nur Admin/CEO.
  - Sperren, Betriebsferien: alle mit App-Zugriff lesen, nur Admin/CEO schreiben. Konfliktpaare: nur Admin/CEO.
  - `tage` serverseitig berechnen (Server Action oder DB-Funktion), nicht dem Client vertrauen.

## Seiten
### Mitarbeiter: `/urlaub`
- Kopf: Resturlaub groß, darunter Anspruch / Übertrag (Verfall) / genommen / geplant / beantragt.
- Button „Urlaub beantragen“ → Formular: Art (Urlaub, Überstundenabbau, Sonderurlaub; Krankmeldung ausgegraut), von–bis (Datumsauswahl), halber Tag am Anfang/Ende, Kommentar. Live-Anzeige „X Arbeitstage“ und Hinweis bei Sperre/Feiertagen/Betriebsferien.
- Jahreskalender (12 Monate, scrollbar, auf dem Handy Monatsansicht): eigene Abwesenheiten (Farbe je Status), Kollegen (Name, beantragt blass), Feiertage BW, Betriebsferien, Sperren. Filter „nur ich / alle“.
- „Meine Anträge“: Liste mit Status, Zurückziehen / Storno beantragen.

### Admin/CEO: `/urlaub/verwaltung`
- **Eingang:** offene Anträge und Stornoanträge, je Zeile: Mitarbeiter, Zeitraum, Tage, Art, Rest nach Genehmigung, Konflikt-Badges (Paar / Sperre, mit Erklärung). Aktionen: Genehmigen, Ablehnen (Begründung).
- **Teamkalender:** Zeilen = Mitarbeiter, Spalten = Tage eines Monats/Jahres, Wochenenden/Feiertage grau, Betriebsferien/Sperren hinterlegt, Konflikte rot. Klick auf Eintrag → Detail.
- **Konten:** Tabelle aller Mitarbeiter mit Anspruch, Übertrag, genommen, geplant, beantragt, Rest; Anspruch/Übertrag/Korrektur bearbeitbar.
- **Einstellungen:** Konfliktpaare, Urlaubssperren, Betriebsferien (mit Schalter), Arbeitsmuster je Mitarbeiter.
- **Protokoll** je Antrag einsehbar.

### Startseite (`app/(app)/page.tsx`)
- Widget für alle mit Zugriff: Resturlaub, offene eigene Anträge mit Status, nächste genehmigte Abwesenheit.
- Für Admin/CEO zusätzlich: Anzahl offener Anträge mit Link zum Eingang.

## Abschluss
- `lib/apps.ts`: `urlaub` auf `live: true` erst nach meinem OK.
- `docs/URLAUB.md` anlegen: Datenmodell, Regeln, Ersteinrichtung (Konten befüllen), was später kommt (Krankmeldung, Resend-Mails, Outlook-Sync, Vertretung, Homeoffice).
- Bericht an mich: was gebaut, welche Migration, was ungetestet ist, offene Fragen.
