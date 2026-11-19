-- Prüfung 19.11.2026 (v49, Block E), angewendet am 19.11.2026 nach Freigabe durch Noah.
-- Neue Funktionen im Schema public sind für nicht angemeldete Besucher (anon / public) nicht mehr automatisch ausführbar.
-- Bestehende Funktionen bleiben unverändert. Angemeldete Nutzer (authenticated) behalten das Standardrecht.
--
-- Vorher (Sicherung):
--   postgres / public / f: {postgres=X, anon=X, authenticated=X, service_role=X}
--   postgres / (alle Schemas) / f: kein Eintrag = PostgreSQL-Standard (PUBLIC darf ausführen)
-- Rückgängig:
--   alter default privileges for role postgres in schema public grant execute on functions to anon;
--   alter default privileges for role postgres grant execute on functions to public;
-- Hinweis: Die Standardrechte von supabase_admin lassen sich über die API nicht ändern (gehören nicht uns).

alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- Probe danach: neue Funktion → anon false, authenticated true (Testfunktion wieder gelöscht).
