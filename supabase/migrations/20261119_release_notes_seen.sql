-- Release-Popup „Was ist neu“: zuletzt gesehene Version je Mitarbeiter.
-- Additiv und idempotent. Mitarbeiter dürfen employees nicht direkt ändern
-- (employees_admin_update_guard); deshalb setzt diese Funktion ausschließlich
-- last_seen_version der EIGENEN Zeile.

alter table public.employees add column if not exists last_seen_version text;

create or replace function public.mark_release_seen(version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if version is null or version !~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' then
    raise exception 'Ungültige Version.' using errcode = '22023';
  end if;
  update public.employees e
     set last_seen_version = version
   where e.id = (select auth.uid());
end;
$$;

revoke all on function public.mark_release_seen(text) from public;
revoke execute on function public.mark_release_seen(text) from anon;
grant execute on function public.mark_release_seen(text) to authenticated;

notify pgrst, 'reload schema';
