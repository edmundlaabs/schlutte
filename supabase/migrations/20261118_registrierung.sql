-- Selbstregistrierung: neue Konten warten auf Freigabe durch CEO/Admin.
alter table public.employees
  add column if not exists pending_approval boolean not null default false;
