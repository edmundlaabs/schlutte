# Plan: Alle Firmen-Apps als Module der Schlutte

Ziel: ein Login, eine Datenbank, Rechte pro Mitarbeiter und App (Zugriff ja/nein, Verwaltung unter
*Mitarbeiter → Zugänge*). CEO/Admin haben immer alles.

## Module

| Modul | Route | Stand / Quelle |
|---|---|---|
| Gerda | `/gerda` | Daten liegen schon in `gerda_*` (Supabase). UI folgt aus Repo `ppl`. |
| Warenbestand WERK 2 | `/warenbestand` | Supabase-Projekt `warenbestand-werk-2` (`ifgkbhtmupnwupttagpr`): `products`, `reservations`, `stock_movements`, `app_users` → Tabellen `lager_*`; `app_users` auf `employees` mappen. UI aus GitHub-Repo (Name offen). |
| Projekte (nic) | `/projekte` | Supabase-Projekt `tfqoeornzjblyvaussow` (pausiert): `users_v2`, `projects_v2`, `tasks`, `project_files` + Bucket `project-files`, `notifications`, `feedback_v2` → `projekte_*`. |
| PandaCAD | `/pandacad` | Installationsseite, Phase 2. |
| Urlaubsantrag | `/urlaub` | neu. |

## Je Modul

1. Layout-Guard `requireAppAccess("<key>")` und RLS mit `public.has_app_access('<key>')`.
2. Tabellen-Präfix je Modul (`gerda_`, `lager_`, `projekte_`).
3. Alte Vercel-Domain leitet auf die neue Route weiter (nicht löschen).
4. Altes Supabase-Projekt danach nur pausieren, nie löschen.

## Datensicherung (Pflicht)

- Vor jeder Migration und jedem Datenumzug: Backup nach `../Backup/<projekt>_<JJJJ-MM-TT_HHMM>/` — Struktur
  (`supabase db dump`), Daten (`supabase db dump --data-only`) und alle Storage-Buckets (Skript mit Service-Role-Key).
  Ohne bestätigtes Backup keine Migration.
- Migrationen nur additiv (kein `drop table/column`, `truncate`, `delete` auf Bestand).
- Nach jedem Umzug Zeilenzahlen pro Tabelle alt/neu vergleichen; bei Abweichung stoppen.
- Alte Projekte/Apps nur pausieren oder umleiten.

## Reihenfolge

1. Zugänge (Matrix, Einladen, Deaktivieren)
2. PandaCAD
3. Gerda
4. Warenbestand
5. nic (Projekte)
6. Urlaub
7. Altes abschalten (pausieren)
