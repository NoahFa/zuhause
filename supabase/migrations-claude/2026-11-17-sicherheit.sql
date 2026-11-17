-- 17.11.2026 – Ergebnisse der Sicherheitsprüfung (Prüf-Agent), von Claude über die Supabase-API ausgeführt.
-- Vorher-Stand der Speicher-Regeln: Mitglieder durften zusätzlich Dateien in „unbekannten“ Ordnern (weder shared noch private)
-- lesen, ändern und löschen. Die App legt alles unter <Haushalt>/shared/… ab; diese Ausnahme entfällt.
drop policy if exists "members can read receipt files" on storage.objects;
create policy "members can read receipt files" on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));
drop policy if exists "members can update receipt files" on storage.objects;
create policy "members can update receipt files" on storage.objects for update to authenticated using (
  bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)))
  with check (
  bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));
drop policy if exists "members can delete receipt files" on storage.objects;
create policy "members can delete receipt files" on storage.objects for delete to authenticated using (
  bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));

-- Datenbank-Funktionen nur für angemeldete Nutzer (vorher auch für nicht angemeldete Besucher aufrufbar; sie prüften die Anmeldung aber selbst).
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
revoke execute on function public.switch_household(text, text) from public, anon;
revoke execute on function public.save_app_state_without_calendar(jsonb, integer) from public, anon;
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.create_default_calendars() from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.switch_household(text, text) to authenticated;
grant execute on function public.save_app_state_without_calendar(jsonb, integer) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Anmeldung (über die Auth-Einstellungen, nicht per SQL): Registrierung geschlossen, Mindestlänge Passwort 8,
-- Weiterleitungen nur noch auf https://noahfa.github.io/zuhause/**. Prüfung geleakter Passwörter erst im Pro-Tarif möglich.
