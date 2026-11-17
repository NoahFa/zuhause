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
| 29 | Charleens Nebenjob: Überstundenkonto. Monatsgrenze (Standard 43 h, je Monat überschreibbar über `job.limitOverrides`), Mehrstunden aufs Konto, fehlende Stunden werden am Monatsende vom Konto aufgefüllt; Auszahlungen/Korrekturen (`job.adjustments`) werden im Monat zuerst verbucht; Verlauf nach Monaten. Charleens Kauler-Hof-Schichten April–November 2026 nachgetragen (April Grenze 21,5 h, da Start am 24.4.; Auszahlung Okt. 32 h / 450 €). |
| 30 | Noahs Nebenjobs (`noah-jobs.js`, Daten in `state.noahJobs`, Seite `#nebenjob`, Karte auf Noahs Startseite): Aufträge mit Kunde/Adresse/Route und Stand (In Arbeit, Abgerechnet, Bezahlt), Stempeluhr je Auftrag (Ein-/Ausstempeln, Zeiten nachtragen, Pause, Notiz), Material mit Menge, Einheit und Preis, Standard-Stundensatz plus eigener Satz je Auftrag, Abrechnung (Stunden × Satz + Material) und Übersicht (Stunden/Lohn im Monat, noch nicht bezahlt). |
| 31 | Charleens Überstundenkonto auf ihre Regel umgestellt: Grenze ist die Minijob-Verdienstgrenze **603 €/Monat** (`job.monthCap`; Stunden = 603 € ÷ Stundenlohn 13,90 € ≈ 43,38 h), keine halbe Grenze im April. Auszahlungen werden in Euro gebucht und über den Stundenlohn in Stunden umgerechnet (450 € ≈ 32,37 h). Ergebnis aus den Uhrzeiten: Konto Ende Oktober 0,00 h. Sicherungen: `sicherung.app_state_20261116_kauler`, `…_kauler2`. |

## Offen / in Klärung

- Derzeit nichts.

## Prüf-Agenten (seit 16.11.2026)

In `.claude/agents/` liegen vier Agenten, die die App nur prüfen und nichts ändern: `pruefer-sicherheit`, `pruefer-oberflaeche`, `pruefer-fehler`, `pruefer-bedienbarkeit`. Mit dem Befehl `/pruefen` laufen alle vier gleichzeitig; das Ergebnis wird zusammengefasst und offene Punkte hier unter „Geplant“ eingetragen. Hilfsmittel: `tests/ui-check.cjs`, `tests/regression.cjs`, `tests/verify-anonymous-access.cjs`.

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

Ergebnis der ersten Prüfung durch die vier Prüf-Agenten (17.11.2026). Noch nichts davon umgesetzt – Noah entscheidet.

**A. Dringend (Eingaben gehen verloren / falsche Beträge)**
1. Fenster in Charleens Bereich (Schicht, Ausstempeln, Auszahlung, Grenze, Sparziel), bei Lou (Pflege) und in Noahs Nebenjobs (Zeit, Material) schreiben in einen veralteten Datenstand, wenn das andere Handy währenddessen speichert → Eingabe weg. Beim Speichern Daten neu holen statt beim Öffnen gemerkten Stand verwenden (`charleen.js`, `lou.js`, `noah-jobs.js`; Ursache `app.js` ersetzt `state` beim Abgleich). Testfall in `tests/regression.cjs` ergänzen.
2. Beträge mit Tausenderpunkt werden falsch gelesen („1.200“ → 1,20 €) – `num()` in `charleen.js` und `noah-jobs.js`.
3. Lohnänderungen rechnen die Vergangenheit um: Charleens Überstundenkonto (Grenze und Euro-Auszahlungen mit aktuellem Stundenlohn; Okt.-Auszahlung einmalig mit 32,37 h festschreiben) und Noahs Nebenjobs (Standardsatz ändert abgerechnete/bezahlte Aufträge; Satz beim Abrechnen festschreiben).
4. Mehrtägige Termine erscheinen nur am ersten Tag (`calendar.js`).
5. Budget: nachträglich erfasste Ausgabe für einen bereits abgeschlossenen Monat zählt nirgends (`features.js`) – relevant, sobald das Budget genutzt wird.

**B. Wichtig (Bedienung und Darstellung)**
6. Termin für einen anderen Tag: Ende-Datum/-Uhrzeit beim Ändern des Beginns mitziehen (sonst Fehlermeldung).
7. Startseite: Termine von morgen und Kalendertermine/Geburtstage in „Demnächst wichtig“ zeigen; Einträge antippbar; keine doppelte Aufgabe in „Offene Aufgaben“ und „Demnächst“.
8. Kalendersuche findet nur im angezeigten Monat → Trefferliste über alle Monate.
9. Löschen per „×“ ohne Rückfrage/Rückgängig (Aufgaben, Einkauf, Caritas, Charleens Aufgaben) → „Gelöscht – Rückgängig“; Aufgaben nachträglich ändern (✎); gelöschte Runde einer Wiederholung kommt zurück → „nur diese Runde / ganze Serie“.
10. Tablet (768 px): „Mehr“ und Montage-Reiter laufen über; Wochenansicht am Handy breiter als der Bildschirm.
11. Karten ohne Innenabstand: Finanzen (Budget, Fixkosten, Sparanalyse) und Dokumente-Filter; Aufgaben-Titel klebt an der Zusatzzeile.
12. „+ Ausgabe“ enthält noch Steuer-Reste („Wer hat bezahlt?“, Bereich Beruf/Hochschule/Nebengewerbe) → vereinfachen.
13. Charleens Bereich am Handy: Reiter erst weit unten → direkt unter den Namen; Überstundenkonto-Hinweis „Mehrstunden kommen am Monatsende aufs Konto“.
14. Termin-Fenster sehr lang → Titel/Wer/Zeit oben, Rest unter „Mehr Optionen“; „Farblabel“ umbenennen.

**C. Sicherheit (kein akutes Risiko)**
15. Registrierung abschalten (beide Konten existieren), Mindestpasswort 8–10 Zeichen, ggf. Prüfung auf geleakte Passwörter.
16. Alte Seite `zuhause-familienapp.pages.dev` (Version 6, gleiche Datenbank) abschalten und aus den erlaubten Weiterleitungen nehmen.
17. Kleinigkeiten: Straßenname in `features.js` maskieren, Link der „Guten Nachricht“ über `safeUrl`, Ausführungsrecht der Datenbankfunktionen für nicht angemeldete Besucher entziehen, Storage-Regel für „unbekannte“ Ordner aufräumen, Sperr-Test um 3 Tabellen ergänzen.
18. Noahs private E-Mail-Adresse steht als Autor in alten Commits → bei GitHub „E-Mail-Adresse privat halten“ einschalten (macht Noah); Verlauf nur auf ausdrücklichen Wunsch umschreiben.
- Hinweis: Der Fund „private Dokumente für beide sichtbar“ ist laut Festlegungen gewollt (keine Geheimhaltung zwischen Noah und Charleen) – kein Handlungsbedarf.

**D. Klein**
19. Größere Tippflächen für ×, ✎, runde ＋ (mind. 40–44 px); untere Leiste am Handy größere/dunklere Beschriftung.
20. Texte: „Kategorien“-Rest bei Charleen (Mehr, Schnellwahl), Noahs Nebenjobs unter „Mehr“, „Stundenkonto“ → „Arbeitszeit“ im Nebenjob-Auftrag, „€ / Stk“ → „€ je Einheit“, Müll-Abzeichen „2a2“ weglassen, Datum in „Demnächst“ als „Heute/Morgen/Do., 19.11.“, Großbuchstaben-„H“ beim Überstundenkonto, geschütztes Leerzeichen vor „h“/„€“.
21. Montage: Vorlagenwahl als erstes Feld, zuletzt benutzte vorauswählen; einheitlicher Name für „Auftrag vorbereiten“; Reiter kürzer („Auto (1)“).
22. Kalender „monatlich am 31.“ in kürzeren Monaten auf den Monatsletzten; Speichern nach Fehler automatisch erneut versuchen; Stempeluhr-Hinweis nach 12 h; Material-Menge 0 nicht zu 1 machen; „Bezahlt ✓“ nicht als großer Hauptknopf während der Auftrag läuft; Lou direkt von der Startseite erreichbar.

## Bewusst verworfen

- **Home-Bildschirm-Widget wie bei TimeTree** (16.11.2026): Für Web-Apps auf dem iPhone nicht möglich. Alternative wäre ein Kalender-Abo-Link für den Apple-Kalender (dessen Widgets) gewesen – Noah hat sich dagegen entschieden.

## Bekannte Grenzen der neuen Funktionen

- ICS-Import: Wiederholungen wie „jeder 2. Dienstag im Monat“ werden nur als erster Termin übernommen; Erinnerungen aus der Datei werden nicht übernommen.
