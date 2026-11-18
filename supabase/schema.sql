-- ============================================================================================================
-- ACHTUNG (18.11.2026): Diese Datei zeigt den Stand der Übergabe vom 16.11.2026 und ist KEIN anwendbarer Patch.
-- Spätere Änderungen stehen in supabase/migrations-claude/*.sql (u. a. strengere Speicher-Regeln vom 17.11.,
-- Tabelle recipes, entzogene Rechte TRUNCATE/REFERENCES/TRIGGER). Beim Wiederaufbau: erst diese Datei, dann alle
-- Migrationen in Datumsreihenfolge – sonst kämen z. B. die alten, weiteren Speicher-Ausnahmen zurück.
-- ============================================================================================================

-- Zuhause Familienapp: gemeinsamer, geschuetzter Datenbereich fuer zwei Personen.
-- Diese Datei kann mehrfach ausgefuehrt werden, ohne vorhandene Daten zu loeschen.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unser Zuhause',
  join_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table if not exists public.app_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_state add column if not exists revision integer not null default 0;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  owner_user_id uuid references auth.users(id) on delete restrict,
  visibility text not null default 'shared' check (visibility in ('private','shared')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  category text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.documents add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;
alter table public.documents add column if not exists visibility text not null default 'shared';
update public.documents set owner_user_id = uploaded_by where owner_user_id is null;
alter table public.documents alter column owner_user_id set not null;
alter table public.documents drop constraint if exists documents_visibility_check;
alter table public.documents add constraint documents_visibility_check check (visibility in ('private','shared'));

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.create_household(
  household_name text default 'Unser Zuhause',
  member_name text default null
)
returns table (household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst anmelden.';
  end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Du gehoerst bereits zu einem Haushalt.';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Unser Zuhause'), auth.uid())
  returning * into new_household;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (new_household.id, auth.uid(), nullif(trim(member_name), ''), 'owner');

  insert into public.app_state (household_id, data, updated_by)
  values (new_household.id, '{}'::jsonb, auth.uid());

  return query select new_household.id, new_household.join_code;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

create or replace function public.join_household(
  invite_code text,
  member_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst anmelden.';
  end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Du gehoerst bereits zu einem Haushalt.';
  end if;

  select id into target_id
  from public.households
  where join_code = upper(trim(invite_code));

  if target_id is null then
    raise exception 'Der Einladungscode ist nicht gueltig.';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (target_id, auth.uid(), nullif(trim(member_name), ''), 'member');

  return target_id;
end;
$$;

revoke all on function public.join_household(text, text) from public;
grant execute on function public.join_household(text, text) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.app_state enable row level security;
alter table public.documents enable row level security;

drop policy if exists "members can read household" on public.households;
create policy "members can read household"
on public.households for select
to authenticated
using (public.is_household_member(id));

drop policy if exists "members can read members" on public.household_members;
create policy "members can read members"
on public.household_members for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members can read app state" on public.app_state;
create policy "members can read app state"
on public.app_state for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members can create app state" on public.app_state;
create policy "members can create app state"
on public.app_state for insert
to authenticated
with check (public.is_household_member(household_id) and updated_by = auth.uid());

drop policy if exists "members can update app state" on public.app_state;
create policy "members can update app state"
on public.app_state for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id) and updated_by = auth.uid());

drop policy if exists "members can read document list" on public.documents;
create policy "members can read document list"
on public.documents for select
to authenticated
using (public.is_household_member(household_id) and (visibility = 'shared' or owner_user_id = auth.uid()));

drop policy if exists "members can add documents" on public.documents;
create policy "members can add documents"
on public.documents for insert
to authenticated
with check (public.is_household_member(household_id) and uploaded_by = auth.uid() and owner_user_id = auth.uid() and visibility in ('private','shared'));

drop policy if exists "members can update documents" on public.documents;
create policy "members can update documents"
on public.documents for update
to authenticated
using (public.is_household_member(household_id) and (visibility = 'shared' or owner_user_id = auth.uid()))
with check (public.is_household_member(household_id) and (visibility = 'shared' or owner_user_id = auth.uid()));

drop policy if exists "members can delete documents" on public.documents;
create policy "members can delete documents"
on public.documents for delete
to authenticated
using (public.is_household_member(household_id) and (visibility = 'shared' or owner_user_id = auth.uid()));

revoke all on public.households, public.household_members, public.app_state, public.documents from anon;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update on public.app_state to authenticated;
grant select, insert, update, delete on public.documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members can read receipt files" on storage.objects;
create policy "members can read receipt files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = 'shared'
    or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)
    or (storage.foldername(name))[2] not in ('shared','private')
  )
);

drop policy if exists "members can upload receipt files" on storage.objects;
create policy "members can upload receipt files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = 'shared'
    or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)
  )
);

drop policy if exists "members can update receipt files" on storage.objects;
create policy "members can update receipt files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = 'shared'
    or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)
    or (storage.foldername(name))[2] not in ('shared','private')
  )
)
with check (
  bucket_id = 'receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = 'shared'
    or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)
    or (storage.foldername(name))[2] not in ('shared','private')
  )
);

drop policy if exists "members can delete receipt files" on storage.objects;
create policy "members can delete receipt files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = 'shared'
    or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)
    or (storage.foldername(name))[2] not in ('shared','private')
  )
);

-- Automatisch geladene Kalendertermine. Eigene Termine bleiben getrennt in app_state.
create table if not exists public.external_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null check (source in ('awb', 'fussball_de')),
  external_id text not null,
  event_date date not null,
  start_time time,
  title text not null,
  person text not null default 'Gemeinsam',
  kind text not null check (kind in ('waste', 'football')),
  status text not null default 'scheduled',
  note text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, source, external_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  enabled boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_key text not null,
  event_date date not null,
  sent_at timestamptz not null default now(),
  unique (subscription_id, reminder_key)
);

create table if not exists public.daily_content (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  content_date date not null,
  headline text not null,
  published_on date,
  source_name text not null default 'Good News',
  source_url text not null,
  fetched_at timestamptz not null default now(),
  unique (household_id, content_date)
);

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('ok', 'error')),
  item_count integer not null default 0,
  message text,
  ran_at timestamptz not null default now()
);

create index if not exists external_events_household_date_idx on public.external_events (household_id, event_date);
create index if not exists daily_content_household_date_idx on public.daily_content (household_id, content_date desc);

alter table public.external_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.daily_content enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "members can read automatic events" on public.external_events;
create policy "members can read automatic events" on public.external_events for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "members can read own push subscription" on public.push_subscriptions;
create policy "members can read own push subscription" on public.push_subscriptions for select to authenticated using (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "members can add own push subscription" on public.push_subscriptions;
create policy "members can add own push subscription" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "members can update own push subscription" on public.push_subscriptions;
create policy "members can update own push subscription" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "members can delete own push subscription" on public.push_subscriptions;
create policy "members can delete own push subscription" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members can read reminder history" on public.notification_deliveries;
create policy "members can read reminder history" on public.notification_deliveries for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members can read daily good news" on public.daily_content;
create policy "members can read daily good news" on public.daily_content for select to authenticated using (public.is_household_member(household_id));

revoke all on public.external_events, public.push_subscriptions, public.notification_deliveries, public.daily_content, public.sync_runs from anon;
grant select on public.external_events, public.notification_deliveries, public.daily_content to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Normalisierter Familienkalender. app_state bleibt als Rueckfallsicherung erhalten,
-- neue Kalenderdaten werden aber ausschliesslich in diese Tabellen geschrieben.
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  calendar_key text not null check (calendar_key in ('shared', 'person1', 'person2')),
  name text not null check (char_length(name) between 1 and 80),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, calendar_key),
  unique (household_id, id)
);
alter table public.calendars drop constraint if exists calendars_calendar_key_check;
delete from public.calendars old where old.calendar_key in ('noah','charleen') and exists (
  select 1 from public.calendars current where current.household_id = old.household_id and current.calendar_key = case old.calendar_key when 'noah' then 'person1' else 'person2' end
);
update public.calendars set calendar_key = case calendar_key when 'noah' then 'person1' when 'charleen' then 'person2' else calendar_key end,
  name = case calendar_key when 'noah' then 'Person 1' when 'charleen' then 'Person 2' else name end
where calendar_key in ('noah','charleen');
alter table public.calendars add constraint calendars_calendar_key_check check (calendar_key in ('shared','person1','person2'));

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  calendar_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  all_day boolean not null default false,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  timezone text not null default 'Europe/Berlin',
  location text check (location is null or char_length(location) <= 240),
  url text check (url is null or char_length(url) <= 500),
  notes text check (notes is null or char_length(notes) <= 4000),
  label_color text not null default 'calendar' check (label_color in ('calendar','sage','blue','coral','gold','violet')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  revision integer not null default 1 check (revision > 0),
  legacy_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((all_day and start_time is null and end_time is null) or (not all_day and start_time is not null and end_time is not null)),
  unique (household_id, legacy_key),
  unique (household_id, id),
  foreign key (household_id, calendar_id) references public.calendars(household_id, id) on delete cascade
);

create table if not exists public.event_participants (
  event_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (household_id, event_id) references public.calendar_events(household_id, id) on delete cascade
);

create table if not exists public.event_recurrences (
  event_id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  interval_count integer not null default 1 check (interval_count between 1 and 999),
  weekdays smallint[] not null default '{}',
  month_day smallint check (month_day between 1 and 31),
  ends_on date,
  timezone text not null default 'Europe/Berlin',
  rrule text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  foreign key (household_id, event_id) references public.calendar_events(household_id, id) on delete cascade
);

create table if not exists public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  series_event_id uuid not null,
  occurrence_date date not null,
  action text not null check (action in ('skip','replace')),
  replacement_event_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (series_event_id, occurrence_date),
  check ((action = 'replace' and replacement_event_id is not null) or (action = 'skip' and replacement_event_id is null)),
  foreign key (household_id, series_event_id) references public.calendar_events(household_id, id) on delete cascade,
  foreign key (household_id, replacement_event_id) references public.calendar_events(household_id, id) on delete cascade
);

create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes_before integer not null check (minutes_before between 0 and 525600),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, minutes_before),
  foreign key (household_id, event_id) references public.calendar_events(household_id, id) on delete cascade
);

create table if not exists public.event_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  occurrence_date date not null,
  minutes_before integer not null,
  sent_at timestamptz not null default now(),
  unique (subscription_id, event_id, occurrence_date, minutes_before),
  foreign key (household_id, event_id) references public.calendar_events(household_id, id) on delete cascade
);

create index if not exists calendar_events_household_date_idx on public.calendar_events (household_id, start_date, end_date);
create index if not exists event_reminders_user_idx on public.event_reminders (user_id, event_id);
create index if not exists event_deliveries_lookup_idx on public.event_notification_deliveries (user_id, occurrence_date);

alter table public.calendars enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_recurrences enable row level security;
alter table public.event_exceptions enable row level security;
alter table public.event_reminders enable row level security;
alter table public.event_notification_deliveries enable row level security;

drop policy if exists "members manage calendars" on public.calendars;
drop policy if exists "members read calendars" on public.calendars;
create policy "members read calendars" on public.calendars for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add fixed calendars" on public.calendars;
create policy "members add fixed calendars" on public.calendars for insert to authenticated
with check (public.is_household_member(household_id) and calendar_key in ('shared','person1','person2'));
drop policy if exists "members manage calendar events" on public.calendar_events;
create policy "members manage calendar events" on public.calendar_events for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id) and created_by in (select user_id from public.household_members where household_id = calendar_events.household_id) and updated_by = auth.uid());
drop policy if exists "members manage event participants" on public.event_participants;
create policy "members manage event participants" on public.event_participants for all to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and user_id in (select user_id from public.household_members where household_id = event_participants.household_id));
drop policy if exists "members manage event recurrences" on public.event_recurrences;
create policy "members manage event recurrences" on public.event_recurrences for all to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "members manage event exceptions" on public.event_exceptions;
create policy "members manage event exceptions" on public.event_exceptions for all to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and created_by = auth.uid());
drop policy if exists "users read own event reminders" on public.event_reminders;
create policy "users read own event reminders" on public.event_reminders for select to authenticated
using (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "users add own event reminders" on public.event_reminders;
create policy "users add own event reminders" on public.event_reminders for insert to authenticated
with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "users update own event reminders" on public.event_reminders;
create policy "users update own event reminders" on public.event_reminders for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "users delete own event reminders" on public.event_reminders;
create policy "users delete own event reminders" on public.event_reminders for delete to authenticated using (user_id = auth.uid());
drop policy if exists "users read own event deliveries" on public.event_notification_deliveries;
create policy "users read own event deliveries" on public.event_notification_deliveries for select to authenticated
using (user_id = auth.uid() and public.is_household_member(household_id));

revoke all on public.calendars, public.calendar_events, public.event_participants, public.event_recurrences, public.event_exceptions, public.event_reminders, public.event_notification_deliveries from anon;
grant select, insert, update, delete on public.calendars, public.calendar_events, public.event_participants, public.event_recurrences, public.event_exceptions, public.event_reminders to authenticated;
grant select on public.event_notification_deliveries to authenticated;

-- Drei feste Kalender fuer jeden bestehenden Haushalt.
insert into public.calendars (household_id, calendar_key, name, color, sort_order)
select h.id, preset.calendar_key, preset.name, preset.color, preset.sort_order
from public.households h
cross join (values
  ('shared','Gemeinsam','#536b57',0),
  ('person1','Person 1','#54778e',1),
  ('person2','Person 2','#a65f52',2)
) as preset(calendar_key,name,color,sort_order)
on conflict (household_id, calendar_key) do nothing;

-- Bestehende manuelle Termine idempotent uebernehmen. Der JSON-Stand wird nicht geloescht.
insert into public.calendar_events (
  household_id, calendar_id, title, all_day, start_date, end_date, start_time, end_time,
  timezone, label_color, created_by, updated_by, legacy_key
)
select
  s.household_id,
  c.id,
  left(coalesce(nullif(trim(a.item->>'title'),''),'Termin'),160),
  false,
  (a.item->>'date')::date,
  (a.item->>'date')::date,
  case when coalesce(a.item->>'time','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (a.item->>'time')::time else time '09:00' end,
  case when coalesce(a.item->>'time','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then ((a.item->>'time')::time + interval '1 hour')::time else time '10:00' end,
  'Europe/Berlin', 'calendar', coalesce(s.updated_by,h.created_by), coalesce(s.updated_by,h.created_by),
  'app_state:' || coalesce(a.item->>'id',a.ordinality::text)
from public.app_state s
join public.households h on h.id = s.household_id
cross join lateral jsonb_array_elements(coalesce(s.data->'appointments','[]'::jsonb)) with ordinality as a(item, ordinality)
join public.calendars c on c.household_id = s.household_id and c.calendar_key = case coalesce(a.item->>'person','') when 'person1' then 'person1' when 'person2' then 'person2' else 'shared' end
where coalesce(a.item->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (household_id, legacy_key) do nothing;

-- Teilnehmer der uebernommenen Termine passend zu ihrer bisherigen Zuordnung.
insert into public.event_participants (event_id, household_id, user_id)
select e.id, e.household_id, m.user_id
from public.calendar_events e
join public.calendars c on c.id = e.calendar_id and c.household_id = e.household_id
join public.household_members m on m.household_id = e.household_id
where e.legacy_key like 'app_state:%'
  and (c.calendar_key = 'shared' or (c.calendar_key = 'person1' and m.role = 'owner') or (c.calendar_key = 'person2' and m.role = 'member'))
on conflict (event_id, user_id) do nothing;

-- Andere Bereiche koennen weiter gemeinsam im JSON-Dokument gespeichert werden,
-- ohne die Kalender-Sicherung dabei zu veraendern.
drop function if exists public.save_app_state_without_calendar(jsonb);
create or replace function public.save_app_state_without_calendar(next_data jsonb, expected_revision integer)
returns table (updated_at timestamptz, revision integer) language plpgsql security definer set search_path = public as $$
declare target_household uuid; saved_at timestamptz := now(); next_revision integer;
begin
  select household_id into target_household from public.household_members where user_id = auth.uid();
  if target_household is null then raise exception 'Kein Haushalt gefunden.'; end if;
  update public.app_state
  set data = (coalesce(next_data,'{}'::jsonb) - 'appointments') || jsonb_build_object('appointments',coalesce(data->'appointments','[]'::jsonb)),
      updated_by = auth.uid(), updated_at = saved_at, revision = app_state.revision + 1
  where household_id = target_household and app_state.revision = expected_revision
  returning app_state.revision into next_revision;
  if next_revision is null then raise exception 'Revision conflict: gemeinsamer Stand wurde inzwischen geändert.'; end if;
  return query select saved_at, next_revision;
end;
$$;
revoke all on function public.save_app_state_without_calendar(jsonb, integer) from public;
grant execute on function public.save_app_state_without_calendar(jsonb, integer) to authenticated;

-- Neue Haushalte erhalten ihre drei Kalender automatisch.
create or replace function public.create_default_calendars()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.calendars (household_id, calendar_key, name, color, sort_order) values
    (new.id,'shared','Gemeinsam','#536b57',0),
    (new.id,'person1','Person 1','#54778e',1),
    (new.id,'person2','Person 2','#a65f52',2)
  on conflict (household_id, calendar_key) do nothing;
  return new;
end;
$$;
drop trigger if exists households_create_default_calendars on public.households;
create trigger households_create_default_calendars after insert on public.households for each row execute function public.create_default_calendars();

-- Realtime fuer Aenderungen auf dem zweiten Geraet aktivieren.
do $$ begin
  alter publication supabase_realtime add table public.calendar_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_recurrences;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_exceptions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_participants;
exception when duplicate_object then null; end $$;

-- Zuhause v7: Dokumente sind innerhalb des Haushalts immer fuer beide sichtbar.
alter table public.documents add column if not exists folder text not null default 'Gemeinsam';
alter table public.documents add column if not exists ocr_text text not null default '';
alter table public.documents add column if not exists original_paths jsonb not null default '[]'::jsonb;
update public.documents set visibility = 'shared' where visibility <> 'shared';
drop policy if exists "members can read document list" on public.documents;
create policy "members can read document list" on public.documents for select using (public.is_household_member(household_id));
drop policy if exists "members can update documents" on public.documents;
create policy "members can update documents" on public.documents for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "members can delete documents" on public.documents;
create policy "members can delete documents" on public.documents for delete using (public.is_household_member(household_id));

-- Normalisierte Aufgabenserien und unabhaengige Instanzen fuer den spaeteren
-- schrittweisen Umstieg aus app_state. Das Frontend bleibt waehrend der
-- Migration abwaertskompatibel und verliert keine vorhandenen Eintraege.
create table if not exists public.task_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  assignee text not null default 'shared' check (assignee in ('person1','person2','shared')),
  timezone text not null default 'Europe/Berlin',
  recurrence_kind text not null default 'none' check (recurrence_kind in ('none','daily','weekly','biweekly','monthly','custom')),
  recurrence_interval integer,
  recurrence_unit text check (recurrence_unit is null or recurrence_unit in ('days','weeks','months')),
  starts_on date not null,
  ends_on date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.task_instances (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.task_series(id) on delete set null,
  household_id uuid not null references public.households(id) on delete cascade,
  title_snapshot text not null,
  description_snapshot text,
  assignee_snapshot text not null default 'shared' check (assignee_snapshot in ('person1','person2','shared')),
  due_on date not null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  client_operation_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id,due_on)
);
create index if not exists task_series_household_idx on public.task_series(household_id);
create index if not exists task_instances_household_due_idx on public.task_instances(household_id,due_on);
alter table public.task_series enable row level security;
alter table public.task_instances enable row level security;
drop policy if exists "members manage task series" on public.task_series;
create policy "members manage task series" on public.task_series for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "members manage task instances" on public.task_instances;
create policy "members manage task instances" on public.task_instances for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke all on public.task_series, public.task_instances from anon;
grant select, insert, update, delete on public.task_series, public.task_instances to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.task_instances;
exception when duplicate_object then null; end $$;
