-- Erst ausfuehren, nachdem die Edge Functions veroeffentlicht und CRON_SECRET,
-- VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY gesetzt wurden. In Supabase Vault muss
-- derselbe CRON_SECRET unter dem Namen zuhause_cron_secret liegen.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname in ('zuhause-muell','zuhause-fussball','zuhause-good-news','zuhause-erinnerungen','zuhause-termin-erinnerungen');

select cron.schedule('zuhause-muell', '20 4 * * *', $$
  select net.http_post(
    url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/sync-family-content?jobs=waste',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('zuhause-fussball', '10 5,17 * * *', $$
  select net.http_post(
    url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/sync-family-content?jobs=football',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('zuhause-good-news', '30 5 * * *', $$
  select net.http_post(
    url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/sync-family-content?jobs=good_news',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('zuhause-erinnerungen', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/send-waste-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('zuhause-termin-erinnerungen', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://mvdnatelwrakkkvdwcaa.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zuhause_cron_secret' limit 1)),
    body := '{}'::jsonb
  );
$$);
