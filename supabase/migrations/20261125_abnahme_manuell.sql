-- Abnahme: Protokolle manuell anlegen (ohne Profacto-PDF), Protokolle ohne Kommission, Protokoll-Vorlagen.
-- Voraussetzung: 20261120_abnahme.sql.
-- Rein additiv, idempotent, verändert keine Bestandsdaten. NICHT automatisch ausgeführt – im Supabase SQL-Editor laufen lassen.
-- VOR dem Ausführen: Backup nach ../Backup/<projekt>_<JJJJ-MM-TT_HHMM>/ (siehe docs/PLAN-ZUSAMMENFUEHRUNG.md).

-- ─── 1. Protokolle ohne Kommission ───────────────────────────────────────────
-- kommission_nr darf NULL sein (Kleinaufträge). Leere/Leerzeichen-Nummern bleiben verboten.
alter table public.abnahme_protokolle alter column kommission_nr drop not null;

alter table public.abnahme_protokolle drop constraint if exists abnahme_protokolle_kommission_nr_check;
alter table public.abnahme_protokolle add constraint abnahme_protokolle_kommission_nr_check
  check (kommission_nr is null or length(btrim(kommission_nr)) > 0);

-- Ohne Nummer gibt es keine Verknüpfung zu commissions.
alter table public.abnahme_protokolle drop constraint if exists abnahme_protokolle_kommission_commission_check;
alter table public.abnahme_protokolle add constraint abnahme_protokolle_kommission_commission_check
  check (kommission_nr is not null or commission_id is null);

-- ─── 2. Herkunft des Protokolls ──────────────────────────────────────────────
-- Bestand stammt aus dem Profacto-Import (Default). Der Sperr-Trigger vergleicht Zeilen vor/nach
-- einer Änderung; die neue Spalte ändert daran nichts.
alter table public.abnahme_protokolle add column if not exists quelle text not null default 'profacto';
alter table public.abnahme_protokolle drop constraint if exists abnahme_protokolle_quelle_check;
alter table public.abnahme_protokolle add constraint abnahme_protokolle_quelle_check
  check (quelle in ('profacto', 'manuell', 'vorlage'));

-- ─── 3. Protokoll-Vorlagen (komplette Sets aus Räumen + Positionen + Prüfpunkten) ──
-- struktur: { "raeume": [ { "name", "etage", "materialText",
--             "positionen": [ { "titel", "einheit", "beschreibung", "vorlageId": uuid|null,
--                               "pruefpunkte": [ { "de", "en" } ] } ] } ] }
-- vorlageId verweist auf abnahme_vorlagen (Möbeltyp), bewusst ohne Fremdschlüssel:
-- beim Einfügen wird geprüft, ob die Möbeltyp-Vorlage noch existiert und aktiv ist.
create table if not exists public.abnahme_protokoll_vorlagen (
  id           uuid primary key default gen_random_uuid(),
  titel_de     text not null check (length(btrim(titel_de)) > 0),
  titel_en     text not null,
  beschreibung text,
  struktur     jsonb not null default '{"raeume": []}'::jsonb,
  aktiv        boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists abnahme_protokoll_vorlagen_touch on public.abnahme_protokoll_vorlagen;
create trigger abnahme_protokoll_vorlagen_touch before update on public.abnahme_protokoll_vorlagen
  for each row execute function public.abnahme_touch();

alter table public.abnahme_protokoll_vorlagen enable row level security;
drop policy if exists abnahme_protokoll_vorlagen_select on public.abnahme_protokoll_vorlagen;
create policy abnahme_protokoll_vorlagen_select on public.abnahme_protokoll_vorlagen for select to authenticated
  using ((select public.has_app_access('abnahme')));
drop policy if exists abnahme_protokoll_vorlagen_admin on public.abnahme_protokoll_vorlagen;
create policy abnahme_protokoll_vorlagen_admin on public.abnahme_protokoll_vorlagen for all to authenticated
  using ((select public.app_role()) in ('ceo', 'admin'))
  with check ((select public.app_role()) in ('ceo', 'admin'));
grant select, insert, update, delete on public.abnahme_protokoll_vorlagen to authenticated;

-- ─── 4. Startvorlagen (aus den Möbeltyp-Vorlagen, im Admin pflegbar) ─────────
insert into public.abnahme_protokoll_vorlagen (titel_de, titel_en, beschreibung, struktur, sort)
select 'Einbauschrank-Projekt Standard', 'Built-in cabinet project (standard)',
       'Wohnraum mit Einbauschrank und Regal.',
       jsonb_build_object('raeume', jsonb_build_array(jsonb_build_object(
         'name', 'Wohnen', 'etage', '', 'materialText', '',
         'positionen', jsonb_build_array(
           jsonb_build_object('titel', 'Einbauschrank', 'einheit', 'pausch', 'beschreibung', '',
             'vorlageId', (select id from public.abnahme_vorlagen where moebeltyp = 'Schrank' limit 1), 'pruefpunkte', '[]'::jsonb),
           jsonb_build_object('titel', 'Regal', 'einheit', 'pausch', 'beschreibung', '',
             'vorlageId', (select id from public.abnahme_vorlagen where moebeltyp = 'Regal' limit 1), 'pruefpunkte', '[]'::jsonb)
         )))),
       10
where not exists (select 1 from public.abnahme_protokoll_vorlagen where titel_de = 'Einbauschrank-Projekt Standard');

insert into public.abnahme_protokoll_vorlagen (titel_de, titel_en, beschreibung, struktur, sort)
select 'Garderobe + Flur', 'Wardrobe + hallway',
       'Flur mit Garderobe und Handlauf.',
       jsonb_build_object('raeume', jsonb_build_array(jsonb_build_object(
         'name', 'Flur', 'etage', '', 'materialText', '',
         'positionen', jsonb_build_array(
           jsonb_build_object('titel', 'Garderobe', 'einheit', 'pausch', 'beschreibung', '',
             'vorlageId', (select id from public.abnahme_vorlagen where moebeltyp = 'Garderobe' limit 1), 'pruefpunkte', '[]'::jsonb),
           jsonb_build_object('titel', 'Handlauf', 'einheit', 'lfm', 'beschreibung', '',
             'vorlageId', (select id from public.abnahme_vorlagen where moebeltyp = 'Handlauf' limit 1), 'pruefpunkte', '[]'::jsonb)
         )))),
       20
where not exists (select 1 from public.abnahme_protokoll_vorlagen where titel_de = 'Garderobe + Flur');

notify pgrst, 'reload schema';
