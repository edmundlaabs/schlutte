-- PandaCAD-Installationsseite (/pandacad): privater Storage-Bucket + Download-Liste.
-- Voraussetzung: 20261116_app_access.sql und 20261117_gerda_tables.sql
-- (public.has_app_access(), public.app_role()).
-- Rein additiv: nichts wird gelöscht oder verändert. Idempotent.
-- VOR dem Ausführen: Backup nach ../Backup/<projekt>_<JJJJ-MM-TT_HHMM>/ (siehe docs/PLAN-ZUSAMMENFUEHRUNG.md).

-- ── Bucket (privat) ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('pandacad', 'pandacad', false)
on conflict (id) do nothing;

-- Lesen nur mit Freischaltung "pandacad" (CEO/Admin immer). Schreiben: nur Service-Role
-- (Upload-Skript supabase/upload-pandacad-files.mjs) — keine Policy für Clients.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'pandacad_objects_read'
  ) then
    create policy pandacad_objects_read on storage.objects
      for select to authenticated
      using (bucket_id = 'pandacad' and public.has_app_access('pandacad'));
  end if;
end $$;

-- ── Download-Liste ───────────────────────────────────────────────────────────
create table if not exists public.pandacad_downloads (
  id           uuid primary key default gen_random_uuid(),
  titel        text not null,
  beschreibung text,
  storage_path text not null unique,
  reihenfolge  integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.pandacad_downloads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'pandacad_downloads' and policyname = 'pandacad_downloads_read') then
    create policy pandacad_downloads_read on public.pandacad_downloads
      for select to authenticated
      using (public.has_app_access('pandacad'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'pandacad_downloads' and policyname = 'pandacad_downloads_admin_write') then
    create policy pandacad_downloads_admin_write on public.pandacad_downloads
      for all to authenticated
      using (public.app_role() in ('ceo', 'admin'))
      with check (public.app_role() in ('ceo', 'admin'));
  end if;
end $$;

notify pgrst, 'reload schema';
