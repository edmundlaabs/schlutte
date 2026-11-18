-- Auslagen: neuer Status 'erledigt' (versendet → erledigt) und Zähler für rote Punkte.
-- Additiv und idempotent. Reihenfolge: nach 20261118_receipt_visibility.sql.
-- Alle bisherigen Prüfungen auf status = 'versendet' lassen jetzt auch 'erledigt' zu,
-- damit Admins und Mitarbeiter erledigte Anträge weiter einsehen können.

-- 1) Status-Check, neue Spalten
alter table public.expense_claims drop constraint if exists expense_claims_status_check;
alter table public.expense_claims add constraint expense_claims_status_check
  check (status in ('erstellt', 'versendet', 'erledigt'));
alter table public.expense_claims add column if not exists done_at timestamptz;
alter table public.expense_claims add column if not exists done_by uuid references auth.users (id) on delete set null;

-- 2) Versendete UND erledigte Anträge brauchen PDF und Versandzeit
alter table public.expense_claims drop constraint if exists expense_claims_submitted_pdf;
alter table public.expense_claims add constraint expense_claims_submitted_pdf
  check (status = 'erstellt' or (pdf_path is not null and sent_at is not null));

create index if not exists expense_claims_done_idx on public.expense_claims (done_at desc)
  where status = 'erledigt';

-- 3) Lesestatus: auch für erledigte Anträge setzbar
drop policy if exists expense_claim_reads_insert on public.expense_claim_reads;
create policy expense_claim_reads_insert on public.expense_claim_reads
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.app_role()) in ('ceo', 'admin')
    and exists (select 1 from public.expense_claims c where c.id = claim_id and c.status in ('versendet', 'erledigt'))
  );

-- 4) Antraege sichtbar: Eigentümer immer, CEO/Admin bei versendet und erledigt
drop policy if exists expense_claims_select on public.expense_claims;
create policy expense_claims_select on public.expense_claims
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (status in ('versendet', 'erledigt') and (select public.app_role()) in ('ceo', 'admin'))
  );

-- 5) Storage: Antrags-PDFs auch für erledigte Anträge
drop policy if exists auslagen_objects_select on storage.objects;
create policy auslagen_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'auslagen'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.receipts r where r.file_path = storage.objects.name)
      or exists (select 1 from public.card_statements s where s.file_path = storage.objects.name)
      or (
        (select public.app_role()) in ('ceo', 'admin')
        and exists (
          select 1 from public.expense_claims c
          where c.pdf_path = storage.objects.name and c.status in ('versendet', 'erledigt')
        )
      )
    )
  );

-- 6) Belege aus versendeten/erledigten Anträgen (Stand 20261118_receipt_visibility.sql)
drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      payment_method = 'kreditkarte'
      and visible_to_finance
      and (select public.app_role()) in ('ceo', 'admin')
    )
    or (
      (select public.app_role()) in ('ceo', 'admin')
      and exists (
        select 1 from public.expense_claims c
        where c.id = receipts.claim_id and c.user_id = receipts.user_id and c.status in ('versendet', 'erledigt')
      )
    )
  );

-- 7) Klassifizierung eingereichter Privatbelege auch nach „erledigt“ möglich
create or replace function public.classify_submitted_receipt(target_id uuid, channel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.app_role()) not in ('ceo', 'admin') then
    raise exception 'Nur CEO und Administratoren dürfen eingereichte Belege klassifizieren.' using errcode = '42501';
  end if;
  if channel not in ('amex', 'bar', 'ec', 'kreditkarte', 'tank_raststaetten') or channel is null then
    raise exception 'Ungültiger Zahlungsweg.' using errcode = '22023';
  end if;
  update public.receipts r
  set reconciliation_channel = channel
  where r.id = target_id and r.status = 'erfasst' and r.payment_method = 'privat'
    and exists (
      select 1 from public.expense_claims c
      where c.id = r.claim_id and c.user_id = r.user_id and c.status in ('versendet', 'erledigt')
    );
  if not found then
    raise exception 'Eingereichter Beleg nicht gefunden.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.classify_submitted_receipt(uuid, text) from public;
revoke execute on function public.classify_submitted_receipt(uuid, text) from anon;
grant execute on function public.classify_submitted_receipt(uuid, text) to authenticated;

-- 8) Statuswechsel absichern: 'erledigt' nur von CEO/Admin und nur aus 'versendet';
--    Rückgängig (erledigt → versendet) nur CEO/Admin. Erledigte Anträge sind für Eigentümer gesperrt.
create or replace function public.expense_claims_guard_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_finance boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  is_finance := (select public.app_role()) in ('ceo', 'admin');
  if new.status = 'erledigt' and old.status <> 'erledigt' then
    if not is_finance then
      raise exception 'Nur CEO und Administratoren dürfen Anträge als erledigt markieren.' using errcode = '42501';
    end if;
    if old.status <> 'versendet' then
      raise exception 'Nur versendete Anträge können erledigt werden.' using errcode = '23514';
    end if;
  elsif old.status = 'erledigt' and new.status <> 'erledigt' then
    if not is_finance or new.status <> 'versendet' then
      raise exception 'Erledigte Anträge können nur von CEO/Admin zurück auf versendet gesetzt werden.' using errcode = '42501';
    end if;
  elsif old.status = 'erledigt' and not is_finance then
    raise exception 'Erledigte Anträge sind schreibgeschützt.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists expense_claims_guard_status on public.expense_claims;
create trigger expense_claims_guard_status
  before update on public.expense_claims
  for each row execute function public.expense_claims_guard_status();

-- 9) Erledigt markieren / zurücknehmen (CEO/Admin, nie der eigene Antrag)
create or replace function public.set_claim_done(claim uuid, done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if (select public.app_role()) not in ('ceo', 'admin') then
    raise exception 'Nur CEO und Administratoren dürfen diese Aktion ausführen.' using errcode = '42501';
  end if;
  if done then
    update public.expense_claims
       set status = 'erledigt', done_at = now(), done_by = me
     where id = claim and status = 'versendet' and user_id <> me;
  else
    update public.expense_claims
       set status = 'versendet', done_at = null, done_by = null
     where id = claim and status = 'erledigt' and user_id <> me;
  end if;
  if not found then
    raise exception 'Antrag nicht gefunden oder Status passt nicht.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_claim_done(uuid, boolean) from public;
revoke execute on function public.set_claim_done(uuid, boolean) from anon;
grant execute on function public.set_claim_done(uuid, boolean) to authenticated;

-- 10) Zähler für rote Punkte (nur CEO/Admin, sonst alles 0)
create or replace function public.inbox_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if (select public.app_role()) not in ('ceo', 'admin') then
    return jsonb_build_object('urlaub', 0, 'auslagen', 0, 'feedback', 0, 'registrierungen', 0);
  end if;
  return jsonb_build_object(
    'urlaub', (select count(*) from public.urlaub_antraege where status in ('beantragt', 'storno_beantragt')),
    'auslagen', (select count(*) from public.expense_claims where status = 'versendet' and user_id <> me),
    'feedback', (select count(*) from public.feedback where status = 'offen'),
    'registrierungen', (select count(*) from public.employees where pending_approval is true)
  );
end;
$$;
revoke all on function public.inbox_counts() from public;
revoke execute on function public.inbox_counts() from anon;
grant execute on function public.inbox_counts() to authenticated;

notify pgrst, 'reload schema';
