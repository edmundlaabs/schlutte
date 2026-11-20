-- Modul /abnahme: Abnahmeprotokoll + Regiebericht.
-- Voraussetzung: 20261116_app_access.sql / 20261117_gerda_tables.sql (public.has_app_access(), public.app_role()).
-- Rein additiv, idempotent. NICHT automatisch ausgeführt – im Supabase SQL-Editor laufen lassen.
-- VOR dem Ausführen: Backup nach ../Backup/<projekt>_<JJJJ-MM-TT_HHMM>/ (siehe docs/PLAN-ZUSAMMENFUEHRUNG.md).
-- Danach: Admin setzt in „Zugänge“ den Haken „Abnahme“ pro Mitarbeiter (CEO/Admin haben immer Zugriff).
--
-- IDs werden auf dem Tablet erzeugt (uuid), damit offline angelegte Daten beim Sync idempotent per Upsert ankommen.

-- ─── 1. Hilfsfunktion ────────────────────────────────────────────────────────
create or replace function public.abnahme_my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
    from public.employees e
   where e.id = auth.uid()
      or lower(e.email) = lower(auth.jwt() ->> 'email')
   order by (e.id = auth.uid()) desc
   limit 1;
$$;

-- ─── 2. Tabellen ─────────────────────────────────────────────────────────────

create table if not exists public.abnahme_vorlagen (
  id         uuid primary key default gen_random_uuid(),
  moebeltyp  text not null,
  titel_de   text not null,
  titel_en   text not null,
  punkte     jsonb not null default '[]'::jsonb,   -- [{ "de": "...", "en": "..." }]
  aktiv      boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.abnahme_protokolle (
  id                uuid primary key default gen_random_uuid(),
  commission_id     uuid references public.commissions(id) on delete set null,
  kommission_nr     text not null check (length(btrim(kommission_nr)) > 0),
  kunde             text not null check (length(btrim(kunde)) > 0),
  projekt           text,
  titel             text,                           -- z. B. „Teilabnahme EG“
  ort               text,
  sprache           text not null default 'de' check (sprache in ('de', 'en')),
  status            text not null default 'bereit'
                    check (status in ('entwurf', 'bereit', 'in_arbeit', 'abgeschlossen')),
  version           integer not null default 1,
  parent_id         uuid references public.abnahme_protokolle(id) on delete restrict,
  mitarbeiter_id    uuid references public.employees(id) on delete set null,
  mitarbeiter_name  text,
  teilnehmer        jsonb not null default '[]'::jsonb,  -- [{ name, rolle, employee_id? }]
  kunde_email       text,
  kopie_email       text,
  bemerkung         text,
  beginn_at         timestamptz,
  abgeschlossen_at  timestamptz,
  original_path     text,
  pdf_path          text,
  checkout_device   text,
  checkout_user     uuid references public.employees(id) on delete set null,
  checkout_at       timestamptz,
  rev               integer not null default 0,
  created_by        uuid references public.employees(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists abnahme_protokolle_kommission_idx on public.abnahme_protokolle (kommission_nr);
create index if not exists abnahme_protokolle_commission_idx on public.abnahme_protokolle (commission_id);
create index if not exists abnahme_protokolle_status_idx on public.abnahme_protokolle (status, created_at desc);

create table if not exists public.abnahme_raeume (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  sort          integer not null default 0,
  name          text not null,
  etage         text,
  material_text text,
  bemerkung     text
);
create index if not exists abnahme_raeume_protokoll_idx on public.abnahme_raeume (protokoll_id, sort);

create table if not exists public.abnahme_positionen (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  raum_id       uuid references public.abnahme_raeume(id) on delete set null,
  sort          integer not null default 0,
  nr            text,                                -- Profacto-Nr (kann doppelt/lückenhaft sein)
  menge         text,
  einheit       text,
  artikel       text,
  titel         text not null,
  langtext      text,
  relevant      boolean not null default true,
  vorlage_id    uuid references public.abnahme_vorlagen(id) on delete set null,
  status        text not null default 'offen'
                check (status in ('offen', 'io', 'mangel', 'nicht_pruefbar')),
  bemerkung     text
);
create index if not exists abnahme_positionen_protokoll_idx on public.abnahme_positionen (protokoll_id, sort);

create table if not exists public.abnahme_pruefpunkte (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  position_id   uuid not null references public.abnahme_positionen(id) on delete cascade,
  sort          integer not null default 0,
  text_de       text not null,
  text_en       text,
  status        text not null default 'offen'
                check (status in ('offen', 'io', 'mangel', 'nicht_pruefbar')),
  bemerkung     text
);
create index if not exists abnahme_pruefpunkte_position_idx on public.abnahme_pruefpunkte (position_id, sort);

create table if not exists public.abnahme_maengel (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  raum_id       uuid references public.abnahme_raeume(id) on delete set null,
  position_id   uuid references public.abnahme_positionen(id) on delete set null,
  pruefpunkt_id uuid references public.abnahme_pruefpunkte(id) on delete set null,
  sort          integer not null default 0,
  text          text not null check (length(btrim(text)) > 0),
  frist         date,
  erledigt_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists abnahme_maengel_protokoll_idx on public.abnahme_maengel (protokoll_id, sort);

create table if not exists public.abnahme_fotos (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  mangel_id     uuid not null references public.abnahme_maengel(id) on delete cascade,
  path          text not null,
  breite        integer,
  hoehe         integer,
  aufgenommen_at timestamptz not null default now()
);
create index if not exists abnahme_fotos_mangel_idx on public.abnahme_fotos (mangel_id);

create table if not exists public.abnahme_unterschriften (
  id            uuid primary key default gen_random_uuid(),
  protokoll_id  uuid not null references public.abnahme_protokolle(id) on delete cascade,
  bezug         text not null check (bezug in ('raum', 'position', 'schluss_kunde', 'schluss_mitarbeiter')),
  bezug_id      uuid,                              -- raum_id bzw. position_id
  name          text not null,
  rolle         text,
  bild_path     text not null,
  zeitpunkt     timestamptz not null default now()
);
create index if not exists abnahme_unterschriften_protokoll_idx on public.abnahme_unterschriften (protokoll_id);

create table if not exists public.abnahme_regieberichte (
  id               uuid primary key default gen_random_uuid(),
  commission_id    uuid references public.commissions(id) on delete set null,
  kommission_nr    text not null check (length(btrim(kommission_nr)) > 0),
  kunde            text not null check (length(btrim(kunde)) > 0),
  name             text,                           -- Auftraggeber laut Kopf
  strasse          text,
  ort              text,
  telefon          text,
  datum            date not null default current_date,
  beschreibung     text,
  sprache          text not null default 'de' check (sprache in ('de', 'en')),
  status           text not null default 'entwurf' check (status in ('entwurf', 'abgeschlossen')),
  mitarbeiter_id   uuid references public.employees(id) on delete set null,
  mitarbeiter_name text,
  unterschrift_path text,
  unterschrift_name text,
  anerkannt_at     timestamptz,
  kunde_email      text,
  kopie_email      text,
  pdf_path         text,
  checkout_device  text,
  checkout_user    uuid references public.employees(id) on delete set null,
  checkout_at      timestamptz,
  rev              integer not null default 0,
  created_by       uuid references public.employees(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists abnahme_regie_kommission_idx on public.abnahme_regieberichte (kommission_nr);

create table if not exists public.abnahme_regie_zeilen (
  id               uuid primary key default gen_random_uuid(),
  regiebericht_id  uuid not null references public.abnahme_regieberichte(id) on delete cascade,
  pos              integer not null,
  datum            date,
  text             text,
  menge            text,
  laenge           text,
  breite           text,
  staerke          text,
  km               numeric(8,1),
  std_meister      numeric(5,1) not null default 0 check (std_meister >= 0 and std_meister * 2 = trunc(std_meister * 2)),
  std_monteur      numeric(5,1) not null default 0 check (std_monteur >= 0 and std_monteur * 2 = trunc(std_monteur * 2)),
  std_lehrling     numeric(5,1) not null default 0 check (std_lehrling >= 0 and std_lehrling * 2 = trunc(std_lehrling * 2)),
  std_helfer       numeric(5,1) not null default 0 check (std_helfer >= 0 and std_helfer * 2 = trunc(std_helfer * 2))
);
create index if not exists abnahme_regie_zeilen_idx on public.abnahme_regie_zeilen (regiebericht_id, pos);

-- Versandprotokoll für beide Dokumenttypen.
create table if not exists public.abnahme_versand (
  id             uuid primary key default gen_random_uuid(),
  dokument_typ   text not null check (dokument_typ in ('abnahme', 'regie')),
  dokument_id    uuid not null,
  an             text not null,
  kopie          text,
  status         text not null default 'vorgemerkt' check (status in ('vorgemerkt', 'gesendet', 'fehler')),
  fehler         text,
  schluessel     text unique,                        -- Idempotenz (z. B. automatischer Versand je Version)
  ausgeloest_von uuid references public.employees(id) on delete set null,
  ausgeloest_at  timestamptz not null default now(),
  gesendet_at    timestamptz
);
create index if not exists abnahme_versand_dokument_idx on public.abnahme_versand (dokument_typ, dokument_id);

-- ─── 3. Triggers ─────────────────────────────────────────────────────────────

create or replace function public.abnahme_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists abnahme_protokolle_touch on public.abnahme_protokolle;
create trigger abnahme_protokolle_touch before update on public.abnahme_protokolle
  for each row execute function public.abnahme_touch();
drop trigger if exists abnahme_regie_touch on public.abnahme_regieberichte;
create trigger abnahme_regie_touch before update on public.abnahme_regieberichte
  for each row execute function public.abnahme_touch();
drop trigger if exists abnahme_vorlagen_touch on public.abnahme_vorlagen;
create trigger abnahme_vorlagen_touch before update on public.abnahme_vorlagen
  for each row execute function public.abnahme_touch();

-- Abgeschlossene Protokolle sind gesperrt: Änderungen nur über einen Nachtrag (neue Version).
-- Erlaubt bleiben Ablagepfade des PDF und die Kunden-/Kopie-Adresse (Versand).
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
    if (to_jsonb(new) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev')
       is distinct from
       (to_jsonb(old) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev') then
      raise exception 'Das Abnahmeprotokoll ist abgeschlossen. Änderungen nur über einen Nachtrag.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists abnahme_protokolle_guard on public.abnahme_protokolle;
create trigger abnahme_protokolle_guard before update or delete on public.abnahme_protokolle
  for each row execute function public.abnahme_guard_protokoll();

create or replace function public.abnahme_guard_kinder()
returns trigger language plpgsql set search_path = public as $$
declare
  pid uuid;
  locked boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  pid := coalesce(new.protokoll_id, old.protokoll_id);
  select (status = 'abgeschlossen') into locked from public.abnahme_protokolle where id = pid;
  if coalesce(locked, false) then
    raise exception 'Das Abnahmeprotokoll ist abgeschlossen. Änderungen nur über einen Nachtrag.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['abnahme_raeume','abnahme_positionen','abnahme_pruefpunkte','abnahme_maengel','abnahme_fotos','abnahme_unterschriften']
  loop
    execute format('drop trigger if exists %I_guard on public.%I', t, t);
    execute format('create trigger %I_guard before insert or update or delete on public.%I for each row execute function public.abnahme_guard_kinder()', t, t);
  end loop;
end $$;

-- Regiebericht: nach Abschluss gesperrt (Pfad/Adressen bleiben).
create or replace function public.abnahme_guard_regie()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'abgeschlossen' then
      raise exception 'Abgeschlossene Regieberichte können nicht gelöscht werden.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'abgeschlossen' then
    if (to_jsonb(new) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev')
       is distinct from
       (to_jsonb(old) - 'pdf_path' - 'kunde_email' - 'kopie_email' - 'updated_at' - 'checkout_device' - 'checkout_user' - 'checkout_at' - 'rev') then
      raise exception 'Der Regiebericht ist abgeschlossen.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists abnahme_regie_guard on public.abnahme_regieberichte;
create trigger abnahme_regie_guard before update or delete on public.abnahme_regieberichte
  for each row execute function public.abnahme_guard_regie();

create or replace function public.abnahme_guard_regie_zeilen()
returns trigger language plpgsql set search_path = public as $$
declare
  rid uuid;
  locked boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  rid := coalesce(new.regiebericht_id, old.regiebericht_id);
  select (status = 'abgeschlossen') into locked from public.abnahme_regieberichte where id = rid;
  if coalesce(locked, false) then
    raise exception 'Der Regiebericht ist abgeschlossen.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists abnahme_regie_zeilen_guard on public.abnahme_regie_zeilen;
create trigger abnahme_regie_zeilen_guard before insert or update or delete on public.abnahme_regie_zeilen
  for each row execute function public.abnahme_guard_regie_zeilen();

-- ─── 4. Checkout (ein Protokoll nur auf einem Gerät) ─────────────────────────
-- Liefert true, wenn das Gerät das Dokument jetzt hält. p_force nur CEO/Admin.

create or replace function public.abnahme_checkout(p_typ text, p_id uuid, p_device text, p_force boolean default false)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur text;
  me uuid := public.abnahme_my_employee_id();
begin
  if not public.has_app_access('abnahme') then
    raise exception 'Kein Zugriff auf Abnahme.' using errcode = '42501';
  end if;
  if p_force and public.app_role() not in ('ceo', 'admin') then
    raise exception 'Nur CEO und Administratoren dürfen ein Gerät übernehmen.' using errcode = '42501';
  end if;
  if p_typ = 'abnahme' then
    select checkout_device into cur from public.abnahme_protokolle where id = p_id for update;
    if cur is not null and cur <> p_device and not p_force then return false; end if;
    update public.abnahme_protokolle
       set checkout_device = p_device, checkout_user = me, checkout_at = now()
     where id = p_id;
  elsif p_typ = 'regie' then
    select checkout_device into cur from public.abnahme_regieberichte where id = p_id for update;
    if cur is not null and cur <> p_device and not p_force then return false; end if;
    update public.abnahme_regieberichte
       set checkout_device = p_device, checkout_user = me, checkout_at = now()
     where id = p_id;
  else
    raise exception 'Unbekannter Dokumenttyp.';
  end if;
  return true;
end;
$$;

create or replace function public.abnahme_release(p_typ text, p_id uuid, p_device text, p_force boolean default false)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.has_app_access('abnahme') then
    raise exception 'Kein Zugriff auf Abnahme.' using errcode = '42501';
  end if;
  if p_force and public.app_role() not in ('ceo', 'admin') then
    raise exception 'Nur CEO und Administratoren dürfen ein Gerät freigeben.' using errcode = '42501';
  end if;
  if p_typ = 'abnahme' then
    update public.abnahme_protokolle
       set checkout_device = null, checkout_user = null, checkout_at = null
     where id = p_id and (p_force or checkout_device = p_device);
  elsif p_typ = 'regie' then
    update public.abnahme_regieberichte
       set checkout_device = null, checkout_user = null, checkout_at = null
     where id = p_id and (p_force or checkout_device = p_device);
  end if;
end;
$$;

grant execute on function public.abnahme_checkout(text, uuid, text, boolean) to authenticated;
grant execute on function public.abnahme_release(text, uuid, text, boolean) to authenticated;

-- ─── 5. Row Level Security ───────────────────────────────────────────────────
-- Alle Tabellen: nur mit Freischaltung „abnahme“ (CEO/Admin immer).
-- Vorlagen schreiben nur CEO/Admin.

do $$
declare t text;
begin
  foreach t in array array[
    'abnahme_protokolle','abnahme_raeume','abnahme_positionen','abnahme_pruefpunkte',
    'abnahme_maengel','abnahme_fotos','abnahme_unterschriften',
    'abnahme_regieberichte','abnahme_regie_zeilen','abnahme_versand'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.has_app_access(''abnahme''))) with check ((select public.has_app_access(''abnahme'')))',
      t || '_access', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.abnahme_vorlagen enable row level security;
drop policy if exists abnahme_vorlagen_select on public.abnahme_vorlagen;
create policy abnahme_vorlagen_select on public.abnahme_vorlagen for select to authenticated
  using ((select public.has_app_access('abnahme')));
drop policy if exists abnahme_vorlagen_admin on public.abnahme_vorlagen;
create policy abnahme_vorlagen_admin on public.abnahme_vorlagen for all to authenticated
  using ((select public.app_role()) in ('ceo', 'admin'))
  with check ((select public.app_role()) in ('ceo', 'admin'));
grant select, insert, update, delete on public.abnahme_vorlagen to authenticated;

-- ─── 6. Storage (privat) ─────────────────────────────────────────────────────
-- Pfade: protokoll/<id>/original.pdf · …/fotos/<id>.jpg · …/unterschriften/<id>.png · …/abnahme.pdf
--        regie/<id>/unterschrift.png · regie/<id>/regiebericht.pdf

insert into storage.buckets (id, name, public)
values ('abnahme', 'abnahme', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'abnahme_objects_read') then
    create policy abnahme_objects_read on storage.objects for select to authenticated
      using (bucket_id = 'abnahme' and public.has_app_access('abnahme'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'abnahme_objects_insert') then
    create policy abnahme_objects_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'abnahme' and public.has_app_access('abnahme'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'abnahme_objects_update') then
    create policy abnahme_objects_update on storage.objects for update to authenticated
      using (bucket_id = 'abnahme' and public.has_app_access('abnahme'))
      with check (bucket_id = 'abnahme' and public.has_app_access('abnahme'));
  end if;
end $$;

-- ─── 7. Startvorlagen (Prüfpunkte aus dem Papierprotokoll, im Admin pflegbar) ─

insert into public.abnahme_vorlagen (moebeltyp, titel_de, titel_en, punkte, sort)
select v.moebeltyp, v.titel_de, v.titel_en, v.punkte::jsonb, v.sort
from (values
  ('Garderobe', 'Garderobe', 'Wardrobe', '[
     {"de":"Schubladen Funktion","en":"Drawers function"},
     {"de":"Türen Öffnung / Öffnungswinkelbegrenzer","en":"Doors opening / opening angle limiter"},
     {"de":"LED-Beleuchtung","en":"LED lighting"},
     {"de":"Erreichbarkeit Heizverteiler","en":"Access to heating manifold"},
     {"de":"Erreichbarkeit Stromverteiler","en":"Access to electrical distribution board"},
     {"de":"Öffnung / Schließung Stromverteiler","en":"Opening / closing of electrical distribution board"},
     {"de":"Oberfläche","en":"Surface"},
     {"de":"geputzt","en":"Cleaned"}]', 10),
  ('Schrank', 'Schrank', 'Cabinet', '[
     {"de":"Schubladen Funktion","en":"Drawers function"},
     {"de":"Türen Öffnung / Öffnungswinkelbegrenzer","en":"Doors opening / opening angle limiter"},
     {"de":"LED-Beleuchtung","en":"LED lighting"},
     {"de":"Oberfläche","en":"Surface"},
     {"de":"geputzt","en":"Cleaned"}]', 20),
  ('Regal', 'Regal', 'Shelf', '[
     {"de":"LED-Beleuchtung","en":"LED lighting"},
     {"de":"Schubladen Funktion","en":"Drawers function"},
     {"de":"Türen Öffnung / Öffnungswinkelbegrenzer","en":"Doors opening / opening angle limiter"},
     {"de":"Oberfläche","en":"Surface"},
     {"de":"geputzt","en":"Cleaned"}]', 30),
  ('Handlauf', 'Handlauf', 'Handrail', '[
     {"de":"Befestigung / Stabilität","en":"Fixing / stability"},
     {"de":"Oberfläche","en":"Surface"},
     {"de":"geputzt","en":"Cleaned"}]', 40)
) as v(moebeltyp, titel_de, titel_en, punkte, sort)
where not exists (select 1 from public.abnahme_vorlagen x where x.moebeltyp = v.moebeltyp);

notify pgrst, 'reload schema';
