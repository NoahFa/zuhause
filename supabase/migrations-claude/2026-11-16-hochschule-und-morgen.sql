-- 16.11.2026 – Hochschul-Kalender und Morgen-Nachricht (von Claude über die Supabase-API ausgeführt)
-- Sicherung vorher:
create schema if not exists sicherung;
create table if not exists sicherung.external_events_20261116 as select * from public.external_events;

-- Automatische Termine dürfen jetzt auch aus dem Hochschul-Kalender kommen.
alter table public.external_events drop constraint if exists external_events_kind_check;
alter table public.external_events add constraint external_events_kind_check check (kind = any (array['waste','football','study']));
alter table public.external_events drop constraint if exists external_events_source_check;
alter table public.external_events add constraint external_events_source_check check (source = any (array['awb','fussball_de','hochschule']));

-- Zeitgesteuerte Abläufe (Zeiten in UTC; die Funktionen prüfen selbst die Berliner Uhrzeit).
select cron.unschedule('zuhause-hochschule') where exists (select 1 from cron.job where jobname = 'zuhause-hochschule');
select cron.schedule('zuhause-hochschule', '40 4,10,16 * * *', $$
  select net.http_post(url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/sync-family-content?jobs=study', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)), body := '{}'::jsonb);
$$);
select cron.unschedule('zuhause-morgen') where exists (select 1 from cron.job where jobname = 'zuhause-morgen');
select cron.schedule('zuhause-morgen', '2 5,6 * * *', $$
  select net.http_post(url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/send-morning-summary', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)), body := '{}'::jsonb);
$$);
