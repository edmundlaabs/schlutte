-- Abnahme: Abgleich ohne Auschecken. Mehrere Geräte dürfen dasselbe Protokoll bearbeiten; weichen Tablet- und
-- Server-Stand beim Sync voneinander ab, wird abgeglichen und BEIDE Stände werden hier archiviert.
-- Voraussetzung: 20261120_abnahme.sql. Rein additiv, idempotent, ändert keine Bestandsdaten.
-- NICHT automatisch ausgeführt – im Supabase SQL-Editor laufen lassen (oder über die Supabase-Anbindung).

create table if not exists public.abnahme_staende (
  id           uuid primary key default gen_random_uuid(),
  protokoll_id uuid not null references public.abnahme_protokolle(id) on delete cascade,
  art          text not null check (art in ('tablet', 'server')),
  rev          integer not null,                    -- Version des Stands (Server: seine rev; Tablet: Basis-rev)
  geraet       text,                                -- Geräte-ID des Tablets, das abgeglichen hat
  erstellt_von uuid references public.employees(id) on delete set null,
  grund        text not null default 'abgleich',
  doc          jsonb not null,                      -- kompletter Stand (ProtokollDoc)
  created_at   timestamptz not null default now()
);
create index if not exists abnahme_staende_protokoll_idx on public.abnahme_staende (protokoll_id, created_at desc);

alter table public.abnahme_staende enable row level security;
drop policy if exists abnahme_staende_access on public.abnahme_staende;
create policy abnahme_staende_access on public.abnahme_staende for all to authenticated
  using ((select public.has_app_access('abnahme')))
  with check ((select public.has_app_access('abnahme')));
grant select, insert, update, delete on public.abnahme_staende to authenticated;

notify pgrst, 'reload schema';
