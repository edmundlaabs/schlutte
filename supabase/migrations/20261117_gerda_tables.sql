-- Gerda (Aufgabenverwaltung) zieht von Firebase/Firestore nach Supabase um.
-- Voraussetzung: 20261116_app_access.sql (employees.app_access).
-- Tabellen 1:1 nach den Firestore-Sammlungen tasks, persons, customers, feedback.
-- Datums-/Zeitfelder bleiben Text (ISO-Strings wie in der App) → verlustfreier Umzug.
-- Zugriff nur für angemeldete Nutzer mit App-Berechtigung "gerda" (CEO/Admin immer).
-- Idempotent, im Supabase SQL-Editor ausführen.

-- ── Berechtigungsprüfung für RLS (und für die Gerda-App per RPC) ─────────────
create or replace function public.has_app_access(app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.app_role() in ('ceo', 'admin'), false)
    or exists (
      select 1
        from public.employees e
       where (e.id = auth.uid() or lower(e.email) = lower(auth.jwt() ->> 'email'))
         and app = any (e.app_access)
    );
$$;

revoke all on function public.has_app_access(text) from public;
grant execute on function public.has_app_access(text) to authenticated;

-- ── Tabellen ─────────────────────────────────────────────────────────────────
create table if not exists public.gerda_tasks (
  id                 text primary key,
  person             text not null default '',
  kommissions_nummer text not null default '',
  kunde              text not null default '',
  priorisierung      smallint not null default 2,
  bezeichnung        text not null default '',
  aufgabe            text not null default '',
  created_at         text,
  eingetragen_am     text,
  deadline           text,
  erledigt           boolean not null default false,
  sort_order         double precision,
  parent_id          text
);
create index if not exists gerda_tasks_person_idx on public.gerda_tasks (person);

create table if not exists public.gerda_persons (
  name       text primary key,
  active     boolean not null default true,
  short_name text not null default ''
);

create table if not exists public.gerda_customers (
  name text primary key
);

create table if not exists public.gerda_feedback (
  id         text primary key,
  text       text not null default '',
  created_at text,
  reply      text,
  erledigt   boolean not null default false
);

-- ── Row Level Security ───────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['gerda_tasks', 'gerda_persons', 'gerda_customers', 'gerda_feedback']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_app_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.has_app_access(''gerda'')))
         with check ((select public.has_app_access(''gerda'')))',
      t || '_app_access', t
    );
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- Live-Aktualisierung (Supabase Realtime) wie zuvor mit Firestore.
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
