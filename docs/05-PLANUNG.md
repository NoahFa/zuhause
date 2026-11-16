# Planung und Weiterentwicklung (seit Übernahme durch Claude)

Stand: 16. November 2026. Ergänzt `02-UMSETZUNGSSTAND.md`. Noah hat freigegeben, dass fertige und geprüfte Änderungen direkt live gestellt werden.

## Seit der Übergabe erledigt (live)

| Version | Änderung |
|---|---|
| 11 | Montage: eigener Reiter „Verbrauchsmaterial Auto“ (Liste nach Kategorien, ein Tipp = „Auffüllen“, Sammelübersicht, „Alles aufgefüllt“). „Ausrüstung“ heißt jetzt „Maschinen“. |
| 11 | Angemeldet bleiben: Verbindungsprobleme beim Start zeigen „Verbindung wird hergestellt“ statt der Anmeldemaske; automatischer neuer Versuch. |
| 12 | Einmaliges Entfernen aller Beispieldaten (mit Sicherung in `state.resetBackup`; Dokumentdateien im Speicher behalten). Montage-Beispiele werden nicht mehr angelegt. |
| 13 | Kalender: Import von Kalenderdateien (.ics), z. B. TimeTree oder Hochschule. Doppelte werden über `legacy_key` erkannt. |
| 14 | Kalender: Knopf „🎂 Geburtstag“ – jährlich, mit Altersanzeige und Erinnerung. |
| 15 | Aufräumen: untere Leiste Heute · Kalender · Haushalt · Finanzen · Mehr. Ausgeblendet (nur per CSS, nichts gelöscht): Steuerbereich, „Ihr beide“, „Einstellungen“, Karten „Wohnung & Verträge“ und „Haustier“, Arbeitstage-Hinweis. Budget-Formular klappt nach dem Speichern zu. |
| 16 | Abgleich: Hinweis mit Einladungscode, wenn nur eine Person im Zuhause ist; Mitgliederliste im Verbindungsfenster; sofortiger Abgleich beim Zurückkehren in die App. |
| 17 | Kalender-Abgleich: Termine werden beim Zurückkehren in die App und spätestens alle 45 Sekunden neu geladen; abgerissene Live-Verbindung wird neu aufgebaut. Ursache: iPhone trennt die Live-Verbindung im Hintergrund, Kalender wurde sonst nur beim Neustart geladen. |
| 18 | Hochschul-Kalender automatisch in Charleens Kalender (lila, mit Endzeit) und Morgen-Nachricht um 5 Uhr – siehe „Server“ unten. |
| 19 | Kalender springt beim Eintragen/Ändern nicht mehr einen Monat zurück: Wischen zum Blättern zählt nur noch, wenn der Finger auf dem Kalender aufsetzt und waagerecht wischt (vorher löste auf dem iPhone das Loslassen nach „Speichern“ ein Zurückblättern aus). |
| 20 | Lou-Bereich (`lou.js`, Seite über Haushalt und Mehr): nächster Tierarzttermin aus dem Kalender (Titel mit „Tierarzt“, „Lou“ oder 🐾), regelmäßige Pflege mit „Erledigt“ und automatisch berechneter nächster Fälligkeit, Vorschläge (Wurmkur, Floh-/Zeckenschutz, Impfung, Futter, Krallen), Steckbrief mit Tierarzt-Telefon, Futter auf die Einkaufsliste, Lous Dokumente. Fällige Pflege erscheint unter „Demnächst wichtig“ und in der Morgen-Nachricht. Daten in `state.lou`. |
| 21 | Einkaufsliste: Eingabefeld direkt über der Liste, „Oft gekauft“ zum Antippen (Verlauf in `state.shoppingHistory`), ✎ zum Ändern von Artikel/Menge/Bereich (auf Wunsch dauerhaft gemerkt über `customCategories.shopping`), keine Doppelten, „Eingekaufte entfernen“, Abgleich alle 5 Sekunden solange die Haushaltsseite offen ist. |
| 22 | Montage ↔ Kalender: Aufträge erscheinen als ganztägige Einträge in Noahs Kalender (🔧, abgeschlossen ✓; nur lesen, „Auftrag öffnen“ springt in den Auftrag). Neues Feld Adresse mit „Route öffnen“ (Apple Karten) im Auftrag und im Kalender. Montage des Tages in Noahs Morgen-Nachricht. |
| 23 | Putzplan: Bei wiederkehrenden Aufgaben gibt es „Abwechselnd Noah und Charleen“ (`task.alternate`); jede neue Runde ist die andere Person dran, Anzeige „⇄ abwechselnd“. |
| 24 | Charleens Bereich nach ihren Wünschen (`charleen.js`, Daten in `state.charleen`), Reiter: **Studium** (Module mit Prüfungsleistungen und Datum, Stand, Note; Module aus dem Hochschulkalender übernehmen; Prüfungen in Charleens Kalender, „Demnächst“ und Morgen-Nachricht am Tag selbst, am Vortag und eine Woche vorher), **Nebenjob** (Ein-/Ausstempeln, Schichten nachtragen, Pause, Stundenlohn, Trinkgeld, Tagessumme, Monats- und Jahresübersicht, Nachtschichten), **Caritas** (Horizont BeWo To-dos mit Datum), **Sparziele** (Ziel, Einzahlen/Entnehmen, Fortschritt, nötiger Betrag pro Monat), **Notizen** (bisherige Einträge). |
| 25 | „Passwort vergessen“ (Link per E-Mail, danach „Neues Passwort festlegen“ in der App). „Zuhause wechseln“ per Einladungscode im Verbindungsfenster – nur möglich, wenn man im bisherigen Zuhause allein ist (Datenbankfunktion `switch_household`, `supabase/migrations-claude/2026-11-16-zuhause-wechseln.sql`). |
| 26 | Kalenderfarben deutlicher: Gemeinsam grün `#2e7d4f`, Noah blau `#1f6fc5`, Charleen beere `#cc3d6a` (Konstanten in `calendar.js`, überschreiben die Farben aus der Datenbank). Person bestimmt immer die Farbe, Farbmarkierung nur als Punkt; Monatsansicht am Handy zeigt den Titel; Filterpunkte und Avatare N/C angepasst. |
| 27 | Foto von Lou: großes Bild oben im Lou-Bereich mit „Foto ändern“. Beim Hochladen auf max. 1600 px verkleinert (JPEG), privat im Speicher unter `<Haushalt>/shared/lou/…`, Anzeige über zeitlich begrenzten Link; altes Foto wird beim Austausch gelöscht. Pfad in `state.lou.photoPath`. |
| 28 | Charleens Reiter „Notizen“ heißt jetzt „✓ Aufgaben“: einfache Liste ohne Kategorien, Datum freiwillig (nicht mehr vorausgefüllt); Karte „Eigene Kategorien“ entfernt (Wunsch Charleen). Vorhandene Einträge bleiben erhalten. |

## Offen / in Klärung

- Derzeit nichts.

## Server (Supabase) – Stand 16.11.2026

Claude hat über einen Supabase-Zugangsschlüssel von Noah (Access Token „Claude Zuhause“, in der Claude-Umgebung gespeichert, nicht im Code) eingerichtet. Änderungen stehen in `supabase/migrations-claude/2026-11-16-hochschule-und-morgen.sql`. Sicherung vorher: `sicherung.external_events_20261116`.

- **Hochschul-Kalender:** `sync-family-content?jobs=study` holt den Moodle-Export (Secret `STUDY_CALENDAR_URL`, Ziel-Haushalt `STUDY_HOUSEHOLD_ID`), fasst Blöcke eines Fachs am selben Tag zusammen und speichert sie als `external_events` (`source='hochschule'`, `kind='study'`, `person='person2'`, Endzeit in `metadata.end_time`). Entfallene zukünftige Termine werden entfernt. Cron `zuhause-hochschule` um 04:40, 10:40, 16:40 UTC.
- **Morgen-Nachricht:** neue Edge Function `send-morning-summary`, Cron `zuhause-morgen` um 03:02 und 04:02 UTC; gesendet wird nur, wenn es in Berlin 5 Uhr ist (auf Wunsch von Noah, vorher 7 Uhr). Inhalt je Person: Termine (gemeinsam + eigene), Geburtstage mit Alter, Hochschule, Fußball, Müllabholung, fällige/überfällige Aufgaben. Nichts los → keine Nachricht. Doppelversand verhindert über `notification_deliveries` (`morning:<Datum>`). Probelauf ohne Versand: `?dry=1&date=JJJJ-MM-TT`.
- **Termin-Erinnerungen** (`send-event-reminders`) sauber neu bereitgestellt: auf dem Server war die Datei mit einer Supabase-Beispielvorlage vermischt; zusätzlich Erinnerung für Geburtstage am 29. Februar in Nicht-Schaltjahren.
- Push-Geräte: Stand heute nur Noahs iPhone registriert; Charleen muss Mitteilungen in der App einmal erlauben.
- **Anmelde-Mails** (16.11.2026): Supabase leitete Links noch auf die alte Adresse `zuhause-familienapp.pages.dev` (dort läuft eine veraltete Version 6). `site_url` jetzt `https://noahfa.github.io/zuhause/`, die alte Adresse bleibt erlaubt. Mail-Texte bleiben englisch (im kostenlosen Tarif ohne eigenen Mailserver nicht änderbar).
- **Dokumentrechte geprüft** (16.11.2026): Es gibt derzeit keine Dokumente und keine Dateien im Speicher; neue Uploads landen unter `<Haushalt>/shared/…` und sind für beide lesbar. Kein Handlungsbedarf.

## Erledigt außerhalb des Codes

- **16.11.2026 – Charleen ins gemeinsame Zuhause verschoben.** Ursache des fehlenden Abgleichs: Charleens Konto gehörte zu einem eigenen, zweiten Zuhause. Noah hat im Supabase-SQL-Editor ihre Mitgliedschaft in sein Zuhause verschoben (Rolle `member`). Sicherung vorher: `sicherung.household_members_20261116`. Ihr altes Zuhause existiert ohne Mitglieder weiter (Daten nicht gelöscht).
- Für später sinnvoll: Knopf „Zuhause wechseln“ in der App, damit so etwas ohne SQL geht (braucht neue Datenbankfunktion).

## Geplant (Reihenfolge nach Nutzen)

- Derzeit nichts offen. Neue Wünsche von Noah oder Charleen hier ergänzen.

## Bewusst verworfen

- **Home-Bildschirm-Widget wie bei TimeTree** (16.11.2026): Für Web-Apps auf dem iPhone nicht möglich. Alternative wäre ein Kalender-Abo-Link für den Apple-Kalender (dessen Widgets) gewesen – Noah hat sich dagegen entschieden.

## Bekannte Grenzen der neuen Funktionen

- ICS-Import: Wiederholungen wie „jeder 2. Dienstag im Monat“ werden nur als erster Termin übernommen; Erinnerungen aus der Datei werden nicht übernommen.
