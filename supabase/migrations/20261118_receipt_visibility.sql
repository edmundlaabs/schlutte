-- Sichtbarkeit von Firmenbelegen einstellbar machen.
--
-- Bisher sah jede CEO/Admin-Person ALLE Belege mit payment_method = 'kreditkarte'
-- (auch Entwürfe) von allen anderen CEO/Admins. Belege, die CEO/Admin hochladen,
-- erhalten automatisch 'kreditkarte' — so konnte z. B. Noah einen 18-€-Beleg von
-- Eddy sehen, der gar nicht für ihn gedacht war.
--
-- Neu: receipts.visible_to_finance. Der Besitzer entscheidet per Auswahlhaken, ob
-- ein Firmenbeleg für CEO/Admin (Kartenabgleich) sichtbar ist. Default true, damit
-- der bisherige Abgleich-Ablauf unverändert bleibt; false = nur für den Besitzer.
-- Privatbelege in versendeten Anträgen bleiben für CEO/Admin sichtbar (Erstattung).

alter table public.receipts add column if not exists visible_to_finance boolean not null default true;

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
        where c.id = receipts.claim_id and c.user_id = receipts.user_id and c.status = 'versendet'
      )
    )
  );

drop policy if exists receipts_update on public.receipts;
create policy receipts_update on public.receipts
  for update to authenticated
  using (
    (
      user_id = (select auth.uid())
      or (payment_method = 'kreditkarte' and visible_to_finance and (select public.app_role()) in ('ceo', 'admin'))
    )
    and claim_id is null
  )
  with check (
    (
      user_id = (select auth.uid())
      or (payment_method = 'kreditkarte' and visible_to_finance and (select public.app_role()) in ('ceo', 'admin'))
    )
    and (
      claim_id is null
      or exists (
        select 1 from public.expense_claims c
         where c.id = receipts.claim_id
           and c.user_id = (select auth.uid())
      )
    )
  );

-- Nur der Besitzer darf die Sichtbarkeit ändern (nicht andere CEO/Admins).
create or replace function public.receipts_guard_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and tg_op = 'UPDATE'
     and new.visible_to_finance is distinct from old.visible_to_finance
     and old.user_id is distinct from (select auth.uid()) then
    raise exception 'Nur der Besitzer darf die Sichtbarkeit eines Belegs ändern.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists receipts_guard_visibility on public.receipts;
create trigger receipts_guard_visibility
  before update on public.receipts
  for each row execute function public.receipts_guard_visibility();

notify pgrst, 'reload schema';
