-- Rezeptkatalog (18.11.2026, mit Noah abgestimmt): eigene Tabelle statt im gemeinsamen App-Datensatz,
-- weil der App-Datensatz bei jeder Änderung (z. B. Einkauf abhaken) komplett hochgeladen wird.
-- Vorher gesichert: sicherung.app_state_20261118_rezepte
-- Basics-Liste und Rezept-Kategorien bleiben im App-Datensatz (settings.recipeBasics, customCategories.recipes).

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  favorite boolean not null default false,
  -- servings, ingredients [{amount, unit, name}], steps [text], categories [text], source, photoPath, changedAt
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists recipes_household_updated on public.recipes (household_id, updated_at);

-- Serverzeit als Abgleich-Marke: jedes Handy lädt nur, was seit dem letzten Mal geändert wurde
create or replace function public.recipes_touch() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.household_id := old.household_id; new.created_at := old.created_at; new.created_by := old.created_by; end if;
  return new;
end $$;
drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before insert or update on public.recipes for each row execute function public.recipes_touch();
revoke execute on function public.recipes_touch() from public, anon, authenticated;

alter table public.recipes enable row level security;
drop policy if exists "members read recipes" on public.recipes;
create policy "members read recipes" on public.recipes for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add recipes" on public.recipes;
create policy "members add recipes" on public.recipes for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists "members change recipes" on public.recipes;
create policy "members change recipes" on public.recipes for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "members delete recipes" on public.recipes;
create policy "members delete recipes" on public.recipes for delete to authenticated using (public.is_household_member(household_id));

revoke all on public.recipes from anon, public;
grant select, insert, update, delete on public.recipes to authenticated;
revoke truncate, references, trigger on public.recipes from authenticated;
