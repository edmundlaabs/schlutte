-- Abnahme 1.7.0: öffentlicher Foto-Link (Token), Foto-Varianten (Original/Vorschau), PDF-Historie.
-- Rein additiv und idempotent; ändert keine Bestandsdaten. Vorher Backup nach ../Backup/… (siehe docs/ABNAHME.md).

-- ─── 1. Öffentlicher Link ────────────────────────────────────────────────────
-- Der Token entsteht beim Abschluss auf dem Gerät (das PDF braucht ihn offline). Jede Version hat einen eigenen.
alter table public.abnahme_protokolle
  add column if not exists public_token         text,
  add column if not exists public_aktiv         boolean not null default true,
  add column if not exists public_erstellt_at   timestamptz,
  add column if not exists public_widerrufen_at timestamptz;

create unique index if not exists abnahme_protokolle_public_token_uq on public.abnahme_protokolle (public_token);

-- Format: base64url, 32–64 Zeichen (Client erzeugt 128 Bit = 22 Zeichen min.; wir verwenden 24 Byte = 32 Zeichen).
alter table public.abnahme_protokolle drop constraint if exists abnahme_protokolle_public_token_format;
alter table public.abnahme_protokolle
  add constraint abnahme_protokolle_public_token_format
  check (public_token is null or public_token ~ '^[A-Za-z0-9_-]{32,64}$');

-- ─── 2. Foto-Varianten ───────────────────────────────────────────────────────
-- path       = bisherige Datei (1600 px, für PDF/Begehung); Fallback für alte Fotos
-- path_original / path_thumb = neue Varianten, nullable
alter table public.abnahme_fotos
  add column if not exists path_original text,
  add column if not exists path_thumb    text;
alter table public.abnahme_objektfotos
  add column if not exists path_original text,
  add column if not exists path_thumb    text;

-- ─── 3. PDF-Historie (altes PDF bleibt erhalten, wenn das PDF neu erzeugt wird) ─
create table if not exists public.abnahme_pdf_historie (
  id           uuid primary key default gen_random_uuid(),
  protokoll_id uuid not null references public.abnahme_protokolle(id) on delete cascade,
  pdf_path     text not null,                       -- das ersetzte PDF (bleibt im Storage liegen)
  grund        text not null,
  ersetzt_von  uuid references public.employees(id) on delete set null,
  ersetzt_at   timestamptz not null default now()
);
create index if not exists abnahme_pdf_historie_protokoll_idx on public.abnahme_pdf_historie (protokoll_id, ersetzt_at desc);

alter table public.abnahme_pdf_historie enable row level security;
drop policy if exists abnahme_pdf_historie_access on public.abnahme_pdf_historie;
create policy abnahme_pdf_historie_access on public.abnahme_pdf_historie for all to authenticated
  using ((select public.has_app_access('abnahme')))
  with check ((select public.has_app_access('abnahme')));
grant select, insert, update, delete on public.abnahme_pdf_historie to authenticated;

-- ─── 4. Sperr-Trigger: kontrollierte Ausnahme ────────────────────────────────
-- Abgeschlossene Protokolle bleiben gesperrt. Änderbar sind nur (wie bisher) Ablagepfad des PDF, Adressen,
-- technische Felder – NEU: die Spalten public_* (Link deaktivieren / neuen Link erzeugen).
-- Alles andere weiterhin nur über einen Nachtrag.
create or replace function public.abnahme_guard_protokoll()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'abgeschlossen' then
      raise exception 'Abgeschlossene Abnahmeprotokolle können nicht gelöscht werden.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'abgeschlossen' then
    if (to_jsonb(new) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev' - 'public_token' - 'public_aktiv' - 'public_erstellt_at' - 'public_widerrufen_at')
       is distinct from
       (to_jsonb(old) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev' - 'public_token' - 'public_aktiv' - 'public_erstellt_at' - 'public_widerrufen_at') then
      raise exception 'Das Abnahmeprotokoll ist abgeschlossen. Änderungen nur über einen Nachtrag.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Die Foto-Tabellen bleiben nach Abschluss gesperrt (abnahme_guard_kinder unverändert). Die Pfade der Originale,
-- die erst nach dem Abschluss hochgeladen werden, trägt die Server-Route /api/abnahme/original per Service-Role ein
-- (der Guard lässt service_role durch, weil current_user nicht 'authenticated' ist).

notify pgrst, 'reload schema';
