# Zuhause – Hinweise für Claude

Familien-App für Noah, Charleen (genau so geschrieben) und Hündin Lou. Version 10, übernommen aus der ChatGPT-Übergabe vom 16.11.2026.

## Aufbau
- Die Web-App liegt direkt im Wurzelordner (index.html, app.js, calendar.js, features.js, workspaces.js, *.css, sw.js, vendor/). Kein Build-Schritt.
- Live über GitHub Pages: https://noahfa.github.io/zuhause/ (Push auf `main` veröffentlicht in ca. 1 Minute).
- Anmeldung und Daten: Supabase-Projekt `mvdnatelwrakkkvdwcaa` (Auth + Row Level Security). Der Schlüssel in app.js ist der öffentliche Browser-Schlüssel, kein Geheimnis.
- `supabase/`: Datenbankschema, Cron-Jobs und Edge Functions (Müll-/Termin-Erinnerungen, Inhalte-Sync). Secrets liegen im Supabase-Vault, nie im Code.
- `tests/`: Node-Tests aus der ChatGPT-Zeit.

## Vor jeder Änderung lesen
- `docs/01-ALLE-FESTLEGUNGEN.md` – alle fachlichen Entscheidungen. Hat Vorrang vor dem Masterprompt.
- `docs/02-UMSETZUNGSSTAND.md` – was fertig, teilweise oder nur geplant ist.
- `docs/03-TECHNISCHE-UEBERGABE.md` – Technik, Datenhaltung, Backend.

## Regeln
- Bestehende App weiterentwickeln, nicht neu bauen. Design erhalten.
- Bei Änderungen an JS/CSS die Versionsnummer `?v=` in index.html und sw.js (CACHE und ASSETS) gemeinsam hochzählen, sonst sehen die iPhones den alten Stand.
- Das Repository ist öffentlich: keine Passwörter, privaten Schlüssel, E-Mail-Adressen oder die vollständige Wohnadresse einchecken.
- Datenbank-Änderungen nur nach Rückfrage und mit Sicherung; schema.sql ist kein automatisch anwendbarer Patch.
- Noah ist kein Programmierer: Antworten auf Deutsch, kurz, ohne Fachchinesisch, Ergebnis vor Erklärung.
