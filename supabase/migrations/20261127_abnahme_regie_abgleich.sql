-- Regiebericht: Abgleich ohne Auschecken (wie bei den Abnahmeprotokollen, siehe 20261126_abnahme_abgleich.sql).
-- Archiv beider Stände (Tablet und Server) vor einem Abgleich. Rein additiv, idempotent, ändert keine Bestandsdaten.

create table if not exists public.abnahme_regie_staende (
  id              uuid primary key default gen_random_uuid(),
  regiebericht_id uuid not null references public.abnahme_regieberichte(id) on delete cascade,
  art             text not null check (art in ('tablet', 'server')),
  rev             integer not null,
  geraet          text,
  erstellt_von    uuid references public.employees(id) on delete set null,
  grund           text not null default 'abgleich',
  doc             jsonb not null,
  created_at      timestamptz not null default now()
);
create index if not exists abnahme_regie_staende_idx on public.abnahme_regie_staende (regiebericht_id, created_at desc);

alter table public.abnahme_regie_staende enable row level security;
drop policy if exists abnahme_regie_staende_access on public.abnahme_regie_staende;
create policy abnahme_regie_staende_access on public.abnahme_regie_staende for all to authenticated
  using ((select public.has_app_access('abnahme')))
  with check ((select public.has_app_access('abnahme')));
grant select, insert, update, delete on public.abnahme_regie_staende to authenticated;

notify pgrst, 'reload schema';
