-- 18.11.2026 (Prüfung v45, Block E, mit Noahs Zustimmung): Die internen Funktionen von pg_net (net.http_get/post/…) und die
-- Trigger-Funktion create_default_calendars() durften auch Besucher ohne Anmeldung und angemeldete Nutzer ausführen.
-- Über die App/REST nicht erreichbar (freigegebene Schemas nur public, graphql_public), trotzdem entzogen.
-- Zeitpläne (cron) laufen als postgres und sind nicht betroffen. Stand vorher: alle net-Funktionen für anon/authenticated ausführbar.
-- Rückgängig (nicht empfohlen): grant execute on all functions in schema net to anon, authenticated;
-- Ergebnis: Die net-Funktionen und das Schema net gehören supabase_admin – als postgres lassen sich diese Rechte NICHT entziehen
-- (Befehl läuft ohne Wirkung). Bleibt bewusst so: über die REST-API nicht erreichbar.
revoke execute on all functions in schema net from public, anon, authenticated;
revoke execute on function public.create_default_calendars() from public, anon, authenticated;
