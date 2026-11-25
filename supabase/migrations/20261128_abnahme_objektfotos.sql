-- Abnahme: Objektfotos. Auch bei „i. O.“ wird das Objekt (die Position) fotografiert; das Foto hängt an der Position,
-- nicht an einem Mangel. Rein additiv, idempotent, ändert keine Bestandsdaten.

create table if not exists public.abnahme_objektfotos (
  id             uuid primary key default gen_random_uuid(),
  protokoll_id   uuid not null references public.abnahme_protokolle(id) on delete cascade,
  position_id    uuid not null references public.abnahme_positionen(id) on delete cascade,
  path           text not null,
  breite         integer,
  hoehe          integer,
  aufgenommen_at timestamptz not null default now()
);
create index if not exists abnahme_objektfotos_protokoll_idx on public.abnahme_objektfotos (protokoll_id);
create index if not exists abnahme_objektfotos_position_idx on public.abnahme_objektfotos (position_id);

-- Abgeschlossene Protokolle sind gesperrt (wie die übrigen Kindtabellen).
drop trigger if exists abnahme_objektfotos_guard on public.abnahme_objektfotos;
create trigger abnahme_objektfotos_guard before insert or update or delete on public.abnahme_objektfotos
  for each row execute function public.abnahme_guard_kinder();

alter table public.abnahme_objektfotos enable row level security;
drop policy if exists abnahme_objektfotos_access on public.abnahme_objektfotos;
create policy abnahme_objektfotos_access on public.abnahme_objektfotos for all to authenticated
  using ((select public.has_app_access('abnahme')))
  with check ((select public.has_app_access('abnahme')));
grant select, insert, update, delete on public.abnahme_objektfotos to authenticated;

notify pgrst, 'reload schema';
