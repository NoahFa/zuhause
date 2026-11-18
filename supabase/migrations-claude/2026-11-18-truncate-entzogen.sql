-- 18.11.2026, mit Noahs Zustimmung: Angemeldete Nutzer hatten auf allen Tabellen (Supabase-Standard) die Rechte
-- TRUNCATE (ganze Tabelle leeren – umgeht Row Level Security), REFERENCES und TRIGGER. Die App braucht keins davon.
-- Über die App/REST waren sie nicht nutzbar; trotzdem entzogen. Stand vorher: 18 Tabellen je TRUNCATE/REFERENCES/TRIGGER für authenticated.
-- Rückgängig (nicht empfohlen): grant truncate, references, trigger on all tables in schema public to authenticated;
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;
-- auch für künftig angelegte Tabellen nicht mehr automatisch vergeben
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated, anon;
