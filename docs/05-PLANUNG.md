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

## Offen / in Klärung

- **Abgleich zwischen den Handys:** Beide sind im selben Zuhause (kein Hinweis auf „Heute“). Mit Version 17 behoben, falls es um Kalendertermine ging; Rückmeldung von Noah steht aus.

## Geplant (Reihenfolge nach Nutzen)

1. **Hochschul-Kalender automatisch in Charleens Bereich.**
   - Quelle: Moodle-Kalenderexport der Kolping-Hochschule (ICS). Der Link enthält einen persönlichen Zugangsschlüssel und gehört **nicht** ins Repository, sondern als Secret in den Supabase-Vault.
   - Der Hochschul-Server erlaubt keinen Abruf aus dem Browser (kein CORS). Darum muss der Abruf serverseitig laufen: Erweiterung der Edge Function `sync-family-content`, Speicherung in `external_events` mit `person = 'person2'`, `kind = 'study'`, Quelle `hochschule`.
   - `calendar.js` → `automaticEvent()` ordnet derzeit nur `person1` zu; `person2` muss ergänzt werden, sonst landen die Termine im gemeinsamen Kalender.
   - Mehrere Blöcke am selben Tag mit gleichem Fach ggf. zu einem Eintrag zusammenfassen (Entscheidung offen).
   - Benötigt: Zugriff zum Deployen der Edge Function (Supabase-Zugangstoken) oder Ausführung durch Noah.
   - Bis dahin: einmaliger Import der ICS-Datei über „Kalender → Importieren → Charleen“.
2. **Morgen-Nachricht um 7 Uhr** (Termine, Müll, offene Aufgaben, Geburtstage) über die vorhandene Push-Technik. Benötigt neuen Cron-Job/Edge Function.
3. **Lou-Bereich**: wiederkehrende Erinnerungen (Wurmkur, Floh-/Zeckenschutz, Impfung, Futter), nächster Tierarzttermin, Lous Dokumente.
4. **Einkaufsliste**: häufig gekaufte Artikel mit einem Tipp, Artikel nachträglich bearbeiten, schnellerer Abgleich beim gemeinsamen Einkaufen.
5. **Montage ↔ Kalender**: vorbereiteter Auftrag erscheint am Montagetag im Kalender, optional mit Kundenadresse und Route.
6. **Putzplan mit Wechsel** zwischen Noah und Charleen.
7. Charleens Bereich erst nach Rücksprache mit ihr ausbauen.

## Bekannte Grenzen der neuen Funktionen

- ICS-Import: Wiederholungen wie „jeder 2. Dienstag im Monat“ werden nur als erster Termin übernommen; Erinnerungen aus der Datei werden nicht übernommen.
- Geburtstage am 29. Februar: Anzeige in Nicht-Schaltjahren am 28. Februar, die Server-Erinnerung kommt dann aber nicht (Edge Function `send-event-reminders` prüft nur den exakten Tag).
