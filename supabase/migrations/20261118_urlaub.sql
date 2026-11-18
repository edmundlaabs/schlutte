-- ════════════════════════════════════════════════════════════════════════════
-- Modul Urlaub & Abwesenheit (/urlaub)
-- ════════════════════════════════════════════════════════════════════════════
-- NUR ADDITIV: legt neue Tabellen/Funktionen mit Präfix urlaub_ an. Bestehende
-- Tabellen und Spalten werden nicht verändert oder gelöscht. Mehrfach ausführbar.
--
-- VOR DEM AUSFÜHREN: Backup nach ../Backup/schlutte_<JJJJ-MM-TT_HHMM>/ (Struktur + Daten).
--
-- Inhalt
--   1. Hilfsfunktionen (urlaub_my_employee_id, urlaub_is_admin)
--   2. Tabellen: antraege, kontingente, arbeitsmuster, konfliktpaare, sperren,
--      betriebsferien, protokoll
--   3. Trigger: updated_at, Absicherung der Statuswechsel, Protokoll
--   4. Row Level Security
--   5. urlaub_team_kalender() — Abwesenheiten der Kollegen ohne Details
--
-- SCHREIBWEGE
--   * Neue Anträge legt NUR die Server Action an (Service-Role-Key), nachdem sie
--     Zugriff geprüft und `tage` serverseitig berechnet hat. Mitarbeiter haben
--     deshalb keine INSERT-Policy auf urlaub_antraege.
--   * Zurückziehen / Storno beantragen: eigener Antrag per RLS (UPDATE), vom Trigger
--     auf genau diese Statuswechsel beschränkt.
--   * Genehmigen / Ablehnen / Stornieren: nur CEO/Admin (Trigger + RLS).
--   * `tage` und alle Kernfelder eines Antrags sind nach dem Anlegen unveränderlich.

-- ─── 1. Hilfsfunktionen ──────────────────────────────────────────────────────
-- Gleiche Zuordnung wie public.app_role()/has_app_access(): id = auth.uid()
-- oder E-Mail aus dem JWT.

create or replace function public.urlaub_my_employee_id()
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

revoke all on function public.urlaub_my_employee_id() from public;
grant execute on function public.urlaub_my_employee_id() to authenticated;

create or replace function public.urlaub_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() in ('ceo', 'admin'), false);
$$;

revoke all on function public.urlaub_is_admin() from public;
grant execute on function public.urlaub_is_admin() to authenticated;


-- ─── 2. Tabellen ─────────────────────────────────────────────────────────────

create table if not exists public.urlaub_antraege (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id),
  art              text not null check (art in ('urlaub', 'ueberstunden', 'sonder', 'krank')),
  von              date not null,
  bis              date not null,
  halbtag_start    boolean not null default false,
  halbtag_ende     boolean not null default false,
  tage             numeric(5,1) not null check (tage >= 0),   -- serverseitig berechnet
  status           text not null default 'beantragt'
                   check (status in ('beantragt', 'genehmigt', 'abgelehnt',
                                     'zurueckgezogen', 'storno_beantragt', 'storniert')),
  kommentar        text,
  entschieden_von  uuid references public.employees(id),
  entschieden_am   timestamptz,
  begruendung      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint urlaub_antraege_zeitraum check (bis >= von)
);

create index if not exists urlaub_antraege_employee_idx on public.urlaub_antraege (employee_id, von);
create index if not exists urlaub_antraege_status_idx   on public.urlaub_antraege (status);
create index if not exists urlaub_antraege_zeitraum_idx on public.urlaub_antraege (von, bis);

create table if not exists public.urlaub_kontingente (
  employee_id        uuid not null references public.employees(id),
  jahr               integer not null check (jahr between 2000 and 2100),
  anspruch           numeric(5,1) not null default 0,
  uebertrag          numeric(5,1) not null default 0,
  uebertrag_verfall  date not null,          -- wird per Trigger auf 31.03. des Jahres gesetzt, wenn leer
  korrektur          numeric(5,1) not null default 0,
  korrektur_notiz    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (employee_id, jahr)
);

create table if not exists public.urlaub_arbeitsmuster (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id),
  gueltig_ab   date not null,
  mo boolean not null default true,
  di boolean not null default true,
  mi boolean not null default true,
  "do" boolean not null default true,
  fr boolean not null default true,
  sa boolean not null default false,
  so boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (employee_id, gueltig_ab)
);

create table if not exists public.urlaub_konfliktpaare (
  id          uuid primary key default gen_random_uuid(),
  employee_a  uuid not null references public.employees(id),
  employee_b  uuid not null references public.employees(id),
  created_at  timestamptz not null default now(),
  constraint urlaub_konfliktpaare_reihenfolge check (employee_a < employee_b),
  unique (employee_a, employee_b)
);

create table if not exists public.urlaub_sperren (
  id          uuid primary key default gen_random_uuid(),
  von         date not null,
  bis         date not null,
  titel       text not null,
  created_at  timestamptz not null default now(),
  constraint urlaub_sperren_zeitraum check (bis >= von)
);

create table if not exists public.urlaub_betriebsferien (
  id                 uuid primary key default gen_random_uuid(),
  von                date not null,
  bis                date not null,
  titel              text not null,
  zaehlt_als_urlaub  boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint urlaub_betriebsferien_zeitraum check (bis >= von)
);

create table if not exists public.urlaub_protokoll (
  id            uuid primary key default gen_random_uuid(),
  antrag_id     uuid not null references public.urlaub_antraege(id) on delete cascade,
  aktion        text not null,
  von_employee  uuid references public.employees(id),
  notiz         text,
  created_at    timestamptz not null default now()
);

create index if not exists urlaub_protokoll_antrag_idx on public.urlaub_protokoll (antrag_id, created_at);


-- ─── 3. Trigger ──────────────────────────────────────────────────────────────

-- updated_at (Funktion existiert aus der Auslagen-Migration)
drop trigger if exists urlaub_antraege_set_updated_at on public.urlaub_antraege;
create trigger urlaub_antraege_set_updated_at
  before update on public.urlaub_antraege
  for each row execute function public.set_updated_at();

drop trigger if exists urlaub_kontingente_set_updated_at on public.urlaub_kontingente;
create trigger urlaub_kontingente_set_updated_at
  before update on public.urlaub_kontingente
  for each row execute function public.set_updated_at();

-- Verfallsdatum des Übertrags: Standard 31.03. des Jahres
create or replace function public.urlaub_kontingente_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.uebertrag_verfall is null then
    new.uebertrag_verfall := make_date(new.jahr, 3, 31);
  end if;
  return new;
end;
$$;

drop trigger if exists urlaub_kontingente_defaults on public.urlaub_kontingente;
create trigger urlaub_kontingente_defaults
  before insert on public.urlaub_kontingente
  for each row execute function public.urlaub_kontingente_defaults();

-- Absicherung der Antrags-Statuswechsel (gilt für alle Zugriffe mit Nutzer-JWT;
-- Service-Role und SQL-Editor haben kein auth.uid() und werden nicht eingeschränkt).
create or replace function public.urlaub_antraege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := public.urlaub_my_employee_id();
  admin boolean := public.urlaub_is_admin();
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not admin then
      raise exception 'Anträge werden nur über die App angelegt.';
    end if;
    if new.status <> 'beantragt' then
      raise exception 'Neue Anträge haben den Status „beantragt“.';
    end if;
    return new;
  end if;

  -- UPDATE: Kernfelder sind unveränderlich.
  if new.employee_id    is distinct from old.employee_id
     or new.art         is distinct from old.art
     or new.von         is distinct from old.von
     or new.bis         is distinct from old.bis
     or new.halbtag_start is distinct from old.halbtag_start
     or new.halbtag_ende  is distinct from old.halbtag_ende
     or new.tage        is distinct from old.tage
     or new.kommentar   is distinct from old.kommentar then
    raise exception 'Zeitraum, Art und Tage eines Antrags können nicht geändert werden.';
  end if;

  if new.status = old.status then
    -- Keine Statusänderung: Entscheidungsfelder dürfen nicht verändert werden.
    if new.entschieden_von is distinct from old.entschieden_von
       or new.entschieden_am is distinct from old.entschieden_am
       or new.begruendung    is distinct from old.begruendung then
      raise exception 'Entscheidungsfelder können nur mit einem Statuswechsel gesetzt werden.';
    end if;
    return new;
  end if;

  if admin then
    if not (
         (old.status = 'beantragt'        and new.status in ('genehmigt', 'abgelehnt'))
      or (old.status = 'storno_beantragt' and new.status in ('storniert', 'genehmigt'))
      or (old.status = 'genehmigt'        and new.status = 'storniert')
    ) then
      raise exception 'Statuswechsel % → % ist nicht erlaubt.', old.status, new.status;
    end if;
    if new.status = 'abgelehnt' and coalesce(btrim(new.begruendung), '') = '' then
      raise exception 'Beim Ablehnen ist eine Begründung Pflicht.';
    end if;
    new.entschieden_von := me;
    new.entschieden_am  := now();
    return new;
  end if;

  -- Mitarbeiter: nur eigene Anträge, nur Zurückziehen bzw. Storno beantragen.
  if old.employee_id is distinct from me then
    raise exception 'Nur eigene Anträge können geändert werden.';
  end if;
  if not (
       (old.status = 'beantragt' and new.status = 'zurueckgezogen')
    or (old.status = 'genehmigt' and new.status = 'storno_beantragt')
  ) then
    raise exception 'Statuswechsel % → % ist nicht erlaubt.', old.status, new.status;
  end if;
  if new.entschieden_von is distinct from old.entschieden_von
     or new.entschieden_am is distinct from old.entschieden_am
     or new.begruendung    is distinct from old.begruendung then
    raise exception 'Entscheidungsfelder können nicht gesetzt werden.';
  end if;
  return new;
end;
$$;

drop trigger if exists urlaub_antraege_guard on public.urlaub_antraege;
create trigger urlaub_antraege_guard
  before insert or update on public.urlaub_antraege
  for each row execute function public.urlaub_antraege_guard();

-- Protokoll: jede Statusänderung (und das Anlegen) wird festgehalten.
create or replace function public.urlaub_antraege_protokoll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wer uuid := coalesce(public.urlaub_my_employee_id(), new.employee_id);
begin
  if tg_op = 'INSERT' then
    insert into public.urlaub_protokoll (antrag_id, aktion, von_employee, notiz)
    values (new.id, 'beantragt', wer, new.kommentar);
  elsif new.status is distinct from old.status then
    insert into public.urlaub_protokoll (antrag_id, aktion, von_employee, notiz)
    values (
      new.id,
      case when old.status = 'storno_beantragt' and new.status = 'genehmigt'
           then 'storno_abgelehnt' else new.status end,
      wer,
      new.begruendung
    );
  end if;
  return new;
end;
$$;

drop trigger if exists urlaub_antraege_protokoll on public.urlaub_antraege;
create trigger urlaub_antraege_protokoll
  after insert or update on public.urlaub_antraege
  for each row execute function public.urlaub_antraege_protokoll();


-- ─── 4. Row Level Security ───────────────────────────────────────────────────

alter table public.urlaub_antraege       enable row level security;
alter table public.urlaub_kontingente    enable row level security;
alter table public.urlaub_arbeitsmuster  enable row level security;
alter table public.urlaub_konfliktpaare  enable row level security;
alter table public.urlaub_sperren        enable row level security;
alter table public.urlaub_betriebsferien enable row level security;
alter table public.urlaub_protokoll      enable row level security;

revoke all on public.urlaub_antraege, public.urlaub_kontingente, public.urlaub_arbeitsmuster,
              public.urlaub_konfliktpaare, public.urlaub_sperren, public.urlaub_betriebsferien,
              public.urlaub_protokoll from anon;

-- Anträge: eigene lesen/ändern (Trigger beschränkt auf Zurückziehen/Storno),
-- CEO/Admin alles. Kein INSERT für Mitarbeiter (siehe oben).
drop policy if exists urlaub_antraege_select on public.urlaub_antraege;
create policy urlaub_antraege_select on public.urlaub_antraege for select to authenticated
  using ((select public.urlaub_is_admin())
         or (employee_id = (select public.urlaub_my_employee_id()) and (select public.has_app_access('urlaub'))));

drop policy if exists urlaub_antraege_update on public.urlaub_antraege;
create policy urlaub_antraege_update on public.urlaub_antraege for update to authenticated
  using ((select public.urlaub_is_admin())
         or (employee_id = (select public.urlaub_my_employee_id()) and (select public.has_app_access('urlaub'))))
  with check ((select public.urlaub_is_admin())
         or (employee_id = (select public.urlaub_my_employee_id()) and (select public.has_app_access('urlaub'))));

drop policy if exists urlaub_antraege_admin_insert on public.urlaub_antraege;
create policy urlaub_antraege_admin_insert on public.urlaub_antraege for insert to authenticated
  with check ((select public.urlaub_is_admin()));

grant select, insert, update on public.urlaub_antraege to authenticated;

-- Konten: eigenes lesen, alle nur CEO/Admin; schreiben nur CEO/Admin.
drop policy if exists urlaub_kontingente_select on public.urlaub_kontingente;
create policy urlaub_kontingente_select on public.urlaub_kontingente for select to authenticated
  using ((select public.urlaub_is_admin())
         or (employee_id = (select public.urlaub_my_employee_id()) and (select public.has_app_access('urlaub'))));

drop policy if exists urlaub_kontingente_admin on public.urlaub_kontingente;
create policy urlaub_kontingente_admin on public.urlaub_kontingente for all to authenticated
  using ((select public.urlaub_is_admin())) with check ((select public.urlaub_is_admin()));

grant select, insert, update, delete on public.urlaub_kontingente to authenticated;

-- Arbeitsmuster: eigenes lesen (für die Tageberechnung), schreiben nur CEO/Admin.
drop policy if exists urlaub_arbeitsmuster_select on public.urlaub_arbeitsmuster;
create policy urlaub_arbeitsmuster_select on public.urlaub_arbeitsmuster for select to authenticated
  using ((select public.urlaub_is_admin())
         or (employee_id = (select public.urlaub_my_employee_id()) and (select public.has_app_access('urlaub'))));

drop policy if exists urlaub_arbeitsmuster_admin on public.urlaub_arbeitsmuster;
create policy urlaub_arbeitsmuster_admin on public.urlaub_arbeitsmuster for all to authenticated
  using ((select public.urlaub_is_admin())) with check ((select public.urlaub_is_admin()));

grant select, insert, update, delete on public.urlaub_arbeitsmuster to authenticated;

-- Konfliktpaare und Protokoll: nur CEO/Admin.
drop policy if exists urlaub_konfliktpaare_admin on public.urlaub_konfliktpaare;
create policy urlaub_konfliktpaare_admin on public.urlaub_konfliktpaare for all to authenticated
  using ((select public.urlaub_is_admin())) with check ((select public.urlaub_is_admin()));

grant select, insert, update, delete on public.urlaub_konfliktpaare to authenticated;

drop policy if exists urlaub_protokoll_admin_select on public.urlaub_protokoll;
create policy urlaub_protokoll_admin_select on public.urlaub_protokoll for select to authenticated
  using ((select public.urlaub_is_admin()));

grant select on public.urlaub_protokoll to authenticated;  -- Einträge schreiben nur die Trigger

-- Sperren und Betriebsferien: alle mit App-Zugriff lesen, nur CEO/Admin schreiben.
drop policy if exists urlaub_sperren_select on public.urlaub_sperren;
create policy urlaub_sperren_select on public.urlaub_sperren for select to authenticated
  using ((select public.has_app_access('urlaub')));
drop policy if exists urlaub_sperren_admin on public.urlaub_sperren;
create policy urlaub_sperren_admin on public.urlaub_sperren for all to authenticated
  using ((select public.urlaub_is_admin())) with check ((select public.urlaub_is_admin()));

drop policy if exists urlaub_betriebsferien_select on public.urlaub_betriebsferien;
create policy urlaub_betriebsferien_select on public.urlaub_betriebsferien for select to authenticated
  using ((select public.has_app_access('urlaub')));
drop policy if exists urlaub_betriebsferien_admin on public.urlaub_betriebsferien;
create policy urlaub_betriebsferien_admin on public.urlaub_betriebsferien for all to authenticated
  using ((select public.urlaub_is_admin())) with check ((select public.urlaub_is_admin()));

grant select, insert, update, delete on public.urlaub_sperren, public.urlaub_betriebsferien to authenticated;


-- ─── 5. Teamkalender für Kollegen ────────────────────────────────────────────
-- Nur Name, Zeitraum, Halbtag-Flags und Status (beantragt/genehmigt). Die Art wird
-- bewusst nicht geliefert („abwesend“), Kommentar/Begründung nie. Krankmeldungen
-- anderer erscheinen nicht. ist_eigen kennzeichnet die eigenen Einträge.

create or replace function public.urlaub_team_kalender(p_von date, p_bis date)
returns table (
  name           text,
  von            date,
  bis            date,
  halbtag_start  boolean,
  halbtag_ende   boolean,
  status         text,
  ist_eigen      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.name,
         a.von,
         a.bis,
         a.halbtag_start,
         a.halbtag_ende,
         case when a.status = 'beantragt' then 'beantragt' else 'genehmigt' end,
         a.employee_id = public.urlaub_my_employee_id()
    from public.urlaub_antraege a
    join public.employees e on e.id = a.employee_id
   where public.has_app_access('urlaub')
     and a.status in ('beantragt', 'genehmigt', 'storno_beantragt')
     and a.von <= p_bis
     and a.bis >= p_von
     and coalesce(e.is_active, true)
     and (a.art <> 'krank' or a.employee_id = public.urlaub_my_employee_id())
   order by a.von, e.name;
$$;

revoke all on function public.urlaub_team_kalender(date, date) from public;
grant execute on function public.urlaub_team_kalender(date, date) to authenticated;

-- ─── 6. Härtung: Ausführungsrechte ───────────────────────────────────────────
-- Supabase vergibt EXECUTE standardmäßig auch an anon; "revoke from public" reicht dafür nicht.
-- Policy-Hilfsfunktionen brauchen authenticated (RLS wertet sie mit dem Nutzerrecht aus),
-- Trigger-Funktionen niemanden.
revoke execute on function public.urlaub_my_employee_id() from anon;
revoke execute on function public.urlaub_is_admin() from anon;
revoke execute on function public.urlaub_team_kalender(date, date) from anon;
revoke execute on function public.urlaub_antraege_guard() from anon, authenticated;
revoke execute on function public.urlaub_antraege_protokoll() from anon, authenticated;
revoke execute on function public.urlaub_kontingente_defaults() from anon, authenticated;

notify pgrst, 'reload schema';
