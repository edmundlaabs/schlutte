-- App-Berechtigungen pro Mitarbeiter (eine App je Kachel im Intranet-Hub).
-- Der Admin/CEO vergibt die Freischaltungen in der Mitarbeiterverwaltung.
-- Keys siehe lib/apps.ts. CEO/Admin haben unabhängig davon immer alle Apps.
-- Idempotent, im Supabase SQL-Editor ausführen.

alter table public.employees add column if not exists app_access text[];

-- Bestand: alle bisherigen Mitarbeiter behalten Zugriff auf alles
-- (niemand wird durch das Deployment ausgesperrt). Danach gezielt entziehen.
update public.employees
   set app_access = array[
     'gerda','werkstatt','personal','warenbestand',
     'bestellliste','urlaub','hoellental','auslagen'
   ]
 where app_access is null;

-- Neue Datensätze starten ohne Freischaltung.
alter table public.employees alter column app_access set default '{}';
alter table public.employees alter column app_access set not null;

-- Nur CEO/Admin dürfen Freischaltungen vergeben oder ändern. Verhindert, dass
-- sich ein Nutzer beim Self-Provisioning (app/start/page.tsx) selbst freischaltet.
create or replace function public.employees_guard_app_access()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.app_access), 0) > 0
       and public.app_role() not in ('ceo', 'admin') then
      raise exception 'Nur CEO und Administratoren dürfen App-Berechtigungen vergeben.'
        using errcode = '42501';
    end if;
  elsif new.app_access is distinct from old.app_access then
    if public.app_role() not in ('ceo', 'admin') then
      raise exception 'Nur CEO und Administratoren dürfen App-Berechtigungen ändern.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists employees_guard_app_access on public.employees;
create trigger employees_guard_app_access
  before insert or update on public.employees
  for each row execute function public.employees_guard_app_access();

notify pgrst, 'reload schema';
