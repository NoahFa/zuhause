-- 16.11.2026 – „Zuhause wechseln“: wer in seinem Zuhause allein ist, kann per Einladungscode in ein anderes wechseln.
-- Sicherheitsregel: Wechsel nur, wenn im bisherigen Zuhause sonst niemand ist (ein gemeinsames Zuhause bleibt unangetastet).
-- Das bisherige Zuhause und seine Daten werden nicht gelöscht.
create or replace function public.switch_household(invite_code text, member_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  current_id uuid;
  current_name text;
  others integer;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
  select id into target_id from public.households where join_code = upper(trim(invite_code));
  if target_id is null then raise exception 'Der Einladungscode ist nicht gueltig.'; end if;
  select household_id, display_name into current_id, current_name from public.household_members where user_id = auth.uid();
  if current_id = target_id then raise exception 'Du bist bereits in diesem Zuhause.'; end if;
  if current_id is not null then
    select count(*) into others from public.household_members where household_id = current_id and user_id <> auth.uid();
    if others > 0 then raise exception 'Wechsel nicht moeglich: In deinem jetzigen Zuhause ist noch jemand.'; end if;
    delete from public.household_members where user_id = auth.uid();
  end if;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (target_id, auth.uid(), coalesce(nullif(trim(member_name), ''), current_name), 'member');
  update public.push_subscriptions set household_id = target_id, updated_at = now() where user_id = auth.uid();
  return target_id;
end;
$$;
revoke all on function public.switch_household(text, text) from public;
grant execute on function public.switch_household(text, text) to authenticated;
