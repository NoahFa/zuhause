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
| 32 | Prüfung Teil A: Eingaben in Fenstern (Charleen, Lou, Noahs Nebenjobs) gehen beim Abgleich mit dem anderen Handy nicht mehr verloren (Test in `regression.cjs`); Zahlen mit Tausenderpunkt; Überstundenkonto rechnet mit dem Lohn des jeweiligen Monats, Auszahlungen in Stunden festgeschrieben; Noahs Stundensatz wird beim Abrechnen festgeschrieben; mehrtägige Termine an jedem Tag; Nachträge für abgeschlossene Budget-Monate zählen im laufenden Monat. |
| 33 | Prüfung Teil B: Termin-Ende zieht mit, „Mehr Optionen“ im Termin-Fenster, Suche über alle Monate; Startseite mit „Morgen“ und klickbarem „Demnächst“ (Kalender, Geburtstage, Lou, Caritas); Löschen mit „Rückgängig“, Aufgaben ändern, „nur diese Runde / ganze Serie“; Ausgabe-Fenster ohne Steuer-Reste; Tablet-Überlauf, Karten-Abstände, Tippflächen, Leiste; Charleens Reiter oben; Texte, Lou-Kachel, Nebenjobs unter „Mehr“; Monatsletzter bei „monatlich am 31.“; erneutes Speichern nach Fehler. |
| 34 | Prüfung Teil C/D: Registrierung geschlossen, Passwort mind. 8 Zeichen, nur noch die neue Adresse für Anmelde-Links; Datenbank-Funktionen nur für Angemeldete; engere Speicher-Regeln (`supabase/migrations-claude/2026-11-17-sicherheit.sql`); Straßenname maskiert, Link der „Guten Nachricht“ geprüft; Sperr-Test um 3 Tabellen erweitert; „Noah“/„Charleen“ statt „Person 1/2“; Server-Erinnerungen am Monatsletzten. |

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

**Morgen-Nachricht jeden Tag (18.11.2026, Wunsch Noah):** Am 18.11. kam keine Nachricht, weil nichts anstand (so war es gebaut). Seitdem kommt sie jeden Morgen um 5 Uhr, mit Wetter für Bergisch Gladbach (open-meteo) als erster Zeile, an leeren Tagen „Heute steht nichts an.“ (`send-morning-summary`, Version 9).

**Rezeptkatalog Schritt 1 (18.11.2026, v44, mit Noah abgestimmt):** Reiter „Rezepte“ neben der Einkaufsliste (Haushalt). Neue Tabelle `public.recipes` (je Haushalt, RLS, Migration `supabase/migrations-claude/2026-11-18-rezepte.sql`, Sicherung `sicherung.app_state_20261118_rezepte`); jedes Handy hält eine Kopie + Warteschlange (offline anlegen/ändern), Abgleich im App-Takt, gelöschte Rezepte werden markiert (deleted_at). Rezept eintippen (Zutaten eine pro Zeile, Schritte als Absätze, Quelle), Suche (auch Zutaten), gemeinsames Herz (Favoriten oben), Portionen umrechnen, „Auf die Einkaufsliste“ mit Vorschau (Basics abgewählt, Liste unter „Basics bearbeiten“ → `state.settings.recipeBasics`), Zusammenrechnen bei gleicher/umrechenbarer Einheit (g/kg, ml/l, Stück), Stückzahlen aufgerundet, Bereich über die bestehende Zuordnung (Wortliste um Rezeptzutaten ergänzt; „Reis“ landete vorher bei Tiefkühl). Test `tests/recipes-check.cjs`.
**Rezeptkatalog Schritt 2 (18.11.2026, v45):** „🔗 Aus Link übernehmen“ über die neue Edge Function `import-recipe` (verify_jwt + Prüfung der Haushaltsmitgliedschaft, nur http/https auf Port 80/443, Namen werden aufgelöst und private/interne Adressen abgelehnt – auch nach Weiterleitungen, max. 4 Weiterleitungen, 8 s, Seite ≤ 3 MB, Foto ≤ 5 MB nur JPG/PNG/WebP, kein Instagram). Liest schema.org-Recipe (JSON-LD, auch @graph/HowToSection), zeigt alles im Formular zur Kontrolle, gespeichert wird erst mit „Speichern“; Quelle wird immer mitgespeichert. Fotos (aus Link oder selbst gewählt) auf 1200 px verkleinert im geschützten Speicher `<haushalt>/shared/recipes/`, Anzeige über signierte Links; beim Löschen nach Ablauf von „Rückgängig“ entfernt. Kategorien frei anlegen (im Formular), umbenennen/löschen („Kategorien bearbeiten“, ändert die Rezepte mit), Filter-Chips im Katalog. Getestet: lokal mit Deno gegen echte Seiten (BBC Good Food, emmikochteinfach.de), Chefkoch aus der Testumgebung nicht erreichbar (dort gesperrt) – am iPhone prüfen.
**Aufgefallen (18.11.):** Angemeldete Nutzer haben auf den älteren Tabellen das Datenbankrecht TRUNCATE (Standard von Supabase). Über die App/REST nicht nutzbar; bei `recipes` entzogen, bei den übrigen nur nach Rückfrage.

## Geplant (Reihenfolge nach Nutzen)

Prüfung vom 17.11.2026 umgesetzt (Versionen 32–34, siehe oben). Offen bzw. nur von Noah erledigbar:
- **E-Mail-Adresse im Git-Verlauf:** Noah schaltet bei GitHub unter Settings → Emails „Keep my email addresses private“ ein. Den alten Verlauf umzuschreiben ist aufwendig und nur auf ausdrücklichen Wunsch.
- **Alte Seite `zuhause-familienapp.pages.dev`** (Version 6) läuft noch bei Cloudflare – Noah kann sie dort löschen. Anmelde-Links führen seit 17.11. nicht mehr dorthin.
- **Prüfung auf geleakte Passwörter** ist erst im kostenpflichtigen Supabase-Tarif möglich.
- Nächste Prüfung: `/pruefen`.

**Prüfung vom 18.11.2026 (v39, alle vier Prüf-Agenten) – ✅ alles umgesetzt am 18.11.2026 (Noah: „alle“), v40 (A + Scanner-Bedienung), v41 (C Dokumente), v42 (D Bereiche), v43 (E Aufräumen: Sicherheitsregel ohne fremde Download-Seiten, jsPDF 4.2.1, Warteschlange an Konto/Zuhause gebunden + Nachfrage beim Abmelden, ui-check mit neuer Dokumente-Ansicht, größere Tippflächen). Bewusst nicht: Dokumentdatum als eigene Spalte (bräuchte Datenbankänderung – das erkannte Datum steht im Namen); persönliche Stichworte in scan-analyse.js bleiben (keine Geheimnisse). Ursprüngliche Liste:**
- **A – Falsches und Verlust (dringend):**
  - Scanner liest bei „Betrag … bis zum 26.11.2026“ das Datum als Betrag (26,11 €) – `scan-analyse.js` Betragssuche.
  - Ohne Internet nach App-Update: PDF-/Texterkennungs-Dateien nicht vorab gespeichert → Scan geht nicht in die Warteschlange (`sw.js`).
  - Jeder Upload-Fehler heißt „Kein Internet“; nach 5 Versuchen still liegen bleibende Scans.
  - Zu frühes „PDF speichern“ verwirft Vorschläge und vorgewählte Folgeaktionen (z. B. Material im Auftrag).
- **B – Scanner-Bedienung:**
  - „Übernehmen“ als großer Knopf unten (+ „Übernehmen + nächste Seite“).
  - Schwarzer Tischrand an entzerrten Seiten entfernen.
  - Hinweis „Text wird gelesen …“ deutlich, Erklärung „grün = Vorschlag“.
  - Meldung „zu dunkel“ statt „unscharf“; „Neu aufnehmen“ löscht Seite erst nach neuem Foto.
  - Abbrechen schneller; Speicher bei vielen Seiten schonen (iPhone).
  - Desktop: Scanner-Leisten mittig begrenzen.
- **C – Dokumente-Seite:**
  - Kacheln auf Tablet kaputt (Schriftgröße).
  - Suche und Liste weiter nach oben, Speicher-Anzeige erst ab ~50 % oben.
  - „Dokument scannen“ als grüner Hauptknopf.
  - „Datei hochladen“ mit Speichern-Fenster (Name/Ordner/Kategorie, Vorschläge) statt versteckter Einstellungen.
  - Kategorie-Filter (Festlegung 12).
  - „Zuletzt hinzugefügt“ nur bei langer Liste.
  - Detailfenster: Abstand zwischen Löschen/Abbrechen/Speichern, größeres ×.
  - Teilen am iPhone zuverlässiger (Datei vorladen).
  - Speicher-Anzeige nicht bei jedem Abgleich neu zählen.
- **D – Finanzen/Noah/Charleen/Lou:**
  - Kassenbon-Scan unter Finanzen auf den neuen Scanner umleiten, Artikelzeilen mitspeichern (Festlegung 10.10), Nachfrage bei abgeschlossenem Monat.
  - Charleen: Scan-Knopf aus dem Kopf in die Reiter (Stempeluhr wieder sichtbar).
  - Lou: Fälliges nach oben, „Erledigt“ mit Rückgängig, Knopftext kürzer.
  - Nebenjob: Beleg-Material besser benennen, Hinweis auf Doppelzählung, „Material entfernen“ mit Rückgängig.
  - Haushalt: „×“ in eigener Zeile, doppelter Plus-Knopf.
- **E – Sicherheit/Aufräumen:**
  - Content-Security-Policy: jsdelivr und tessdata-Adresse streichen.
  - Warteschlange an Konto/Zuhause binden.
  - jsPDF auf Version 3 aktualisieren.
  - Gelernte Absender-Schlüssel nicht mitten im Wort kürzen.
  - Dokumentdatum besser wählen.
  - Dateireste bei fehlgeschlagenem Upload aufräumen.
  - `ui-check` um neue Dokumente-Ansicht ergänzen.
- **Nicht prüfbar:** Live-Einstellungen bei Supabase (Zugang für Prüf-Agenten gesperrt); echtes iPhone (Teilen, viele Seiten).

### Dokumentenscanner perfektionieren (Plan vom 17.11.2026)

**Ist-Stand (geprüft im Code):** „Mehrseitig scannen“ öffnet die Kamera mit `capture="environment" multiple` – am iPhone nimmt die Kamera damit aber nur **ein** Foto auf; mehrere Seiten gehen nur über die Fotoauswahl. Zuschnitt (`prepareScanImage` in `features.js`) sucht nur einen hellen Rand und schneidet gerade ab – keine Ecken, keine Entzerrung, keine Drehung, keine Schattenentfernung. Texterkennung (Tesseract, Deutsch) und PDF (jsPDF) werden bei Bedarf aus dem Internet geladen. Ordner, Kategorie und Name müssen vor dem Scannen oben auf der Seite eingestellt werden. Das PDF enthält nur Bilder (Text nicht markier-/kopierbar). Speicher: Supabase-Gratistarif 1 GB, belegt ~1 MB.

**Phase 1 – Scannen am iPhone (Kern)** – ✅ erledigt am 17.11.2026 (v35, `scanner.js`): eigene Scan-Ansicht, Ecken-Erkennung mit Lupe, Entzerren, Drehen, Modi Dokument/Farbe/Original, Warnung bei unscharf/dunkel, Seitenübersicht, durchsuchbares PDF (Phase-3-Punkt 12 gleich mit erledigt), Tesseract und jsPDF unter `vendor/`. Texterkennung läuft immer auf der Schwarz-Weiß-Fassung (besser lesbar).
1. Eigene Scan-Ansicht: Seite fotografieren → Vorschau mit automatisch gefundenen **vier Ecken** (mit dem Finger verschiebbar, Lupe beim Ziehen) → „Übernehmen“ / „Neu aufnehmen“ → „＋ Nächste Seite“ → Seitenübersicht (Reihenfolge ändern, drehen, löschen) → „Fertig“.
2. **Kantenerkennung** (eigene schlanke Umsetzung ohne große Bibliothek): Dokumentkontur suchen; bei Unsicherheit Ecken auf den Bildrand legen – nie Inhalt abschneiden (Festlegung).
3. **Entzerren** (Perspektivkorrektur auf DIN-A4-Verhältnis bzw. Kassenbon-Format) und **automatisch drehen** (Hoch/Quer).
4. **Bildmodus** je Seite: „Dokument“ (heller Hintergrund, Schatten entfernt, gestochen scharfer Text), „Farbe“ (Impfpass-Stempel, Ausweise), „Original“.
5. **Qualitätswarnung** bei unscharfem oder zu dunklem Foto („Nochmal aufnehmen?“).
6. Texterkennung und PDF-Bibliotheken unter `vendor/` selbst ablegen (schneller, offline, behebt den CDN-Hinweis der Sicherheitsprüfung); Texterkennung läuft weiterhin nur auf dem Handy.

**Phase 2 – Auf euch abgestimmt (Einordnen ohne Tippen)** – ✅ erledigt am 17.11.2026 (v36, `scan-analyse.js`): Text wird schon vor dem Speichern gelesen; Vorschläge für Name, Ordner, Kategorie (grün umrandet, änderbar); gelernte Absender in `state.scanRules`; Folgeaktionen per Häkchen (Aufgabe bezahlen, Ausgabe, Kalender-Erinnerung für Verträge, Lous Impfung, Material in Nebenjob-Auftrag, Charleens Nebenjob öffnen); Scan-Knöpfe bei Lou, Charleen und im Nebenjob-Auftrag. Bewusst: kein Häkchen ist vorausgewählt, außer man scannt aus einem Bereich heraus (z. B. „Beleg scannen“ im Auftrag → Material).
7. **Vorschläge nach dem Scannen** aus dem erkannten Text: Ordner (Lou: Tierarzt/Deveci/Lassie/Chipnummer · Charleen: Kolping, Caritas, Kauler Hof · Noah · Gemeinsam: Vermieter, Strom, Internet), Kategorie (Rechnung, Versicherung, Vertrag, Lohn/Steuer, Studium …), **Name** wie „Rechnung Tierarztpraxis Deveci – 12.11.2026“ und Dokumentdatum. Ein Tipp bestätigt, alles bleibt änderbar.
8. **Lernt mit:** ändert ihr einen Vorschlag, merkt sich die App Absender → Ordner/Kategorie.
9. **Folgeaktionen anbieten** (nur auf Nachfrage): Rechnung mit Betrag/Fälligkeit → Aufgabe „bezahlen bis …“; Vertrag mit Kündigungsfrist → Kalender-Erinnerung; Tierarzt-Rechnung/Impfpass → bei Lou „Impfung erledigt am …“; Kassenbon → Ausgabe im Budget; Materialbeleg → Material mit Preis in Noahs Nebenjob-Auftrag; Lohnabrechnung Kauler Hof → Charleens Nebenjob (Abgleich Stunden/Auszahlung).
10. **Scannen von dort, wo man gerade ist:** Knopf „Dokument scannen“ bei Lou, in Charleens Bereich, in Noahs Nebenjob-Auftrag – Ordner/Zuordnung vorausgewählt.

**Phase 3 – Wiederfinden und Ansehen** – ✅ weitgehend erledigt am 17.11.2026 (v37, `documents-view.js`): Ordner-Kacheln mit Anzahl, „Zuletzt hinzugefügt“, Vorschaubilder (`<pfad>.thumb.jpg` neben dem PDF, Fotos zeigen sich selbst), Suche im erkannten Text mit markierter Fundstelle, Detailansicht mit Öffnen, Teilen/Drucken (iPhone-Teilen-Menü), Umbenennen, Ordner/Kategorie ändern, erkanntem Text und Löschen (inkl. Originalfotos). Offen: Seiten an ein bestehendes PDF anfügen und Text aus hochgeladenen (nicht gescannten) PDFs lesen – beides bräuchte eine weitere große Bibliothek (pdf.js/pdf-lib); erst angehen, wenn ihr es vermisst.
11. Dokumentliste mit **Vorschaubild**, Ordner-Kacheln (Gemeinsam/Noah/Charleen/Lou) und „Zuletzt gescannt“; Suchtreffer mit hervorgehobener Fundstelle.
12. **Durchsuchbares PDF** (unsichtbare Textebene), dadurch auch in anderen Apps durchsuchbar und kopierbar.
13. **Teilen** über das iPhone-Teilen-Menü (Mail, WhatsApp, Drucken), Seiten nachträglich anfügen, Dokument umbenennen/verschieben.
14. Bereits hochgeladene PDFs ebenfalls durchsuchbar machen (Text aus dem PDF auslesen).

**Phase 4 – Zuverlässigkeit und Prüfung** – ✅ erledigt am 17.11.2026 (v38): Scans ohne Internet werden im Handy-Speicher (IndexedDB) gesichert und automatisch hochgeladen (Hinweis auf der Dokumente-Seite, „Jetzt versuchen“; automatisch höchstens 5 Versuche je Scan); Speichern lässt sich abbrechen; Originalfotos werden als verkleinertes JPEG gesichert (iPhone-Fotos waren sonst evtl. zu groß/falsches Format); viele Seiten → geringere Bildqualität, damit das PDF unter 10 MB bleibt (eine Seite ≈ 60–150 KB). Testsammlung `tests/scanner-check.cjs` (37 Prüfungen) und Einbindung in `pruefer-fehler`/`pruefer-oberflaeche`.

**Speicherplatz (17.11.2026, v39, auf Noahs Wunsch):** Speicher-Anzeige auf der Dokumente-Seite („x von 1 GB belegt“, Schätzung der noch möglichen Seiten, gelb ab 80 %, rot ab 90 % mit einmaliger Meldung pro Monat, Hinweis im Scanner ab 95 %). Gezählt wird alles im Haushaltsordner des Speichers. Originalfotos werden mit 1600 px statt 2200 px gespeichert (bleiben laut Festlegung erhalten, ~⅓ des Platzes). Grobe Rechnung: ~0,35 MB je gescannter Seite → 1 GB reicht für ~2.800 Seiten. Wenn es knapp wird: alte Dokumente löschen oder Supabase Pro (ca. 25 $/Monat, 100 GB).
15. Scans ohne Netz zwischenspeichern und später automatisch hochladen; Fortschritt und Abbrechen; Seitengröße ~200–400 KB (1 GB reicht für einige Tausend Seiten).
16. **Testsammlung** mit typischen Fällen (schräg, Schatten, Holztisch, Querformat, langer Kassenbon, Impfpass, zerknittert) – automatische Prüfung von Ecken, Entzerrung und Texterkennung; neuer Prüfschritt für `pruefer-fehler`/`pruefer-oberflaeche`.

**Entscheidungen von Noah (17.11.2026):** normale iPhone-Kamera; alle Dokumentarten; alle Folgeaktionen gewünscht. Ursprüngliche Fragen: (a) Fotografieren über die normale iPhone-Kamera (zuverlässig, ein Tipp mehr pro Seite) oder eigene Live-Kamera mit Rahmen und automatischem Auslösen (komfortabler, am iPhone in der Home-Bildschirm-App aufwendiger)? (b) Welche Dokumente scannt ihr am häufigsten? (c) Folgeaktionen aus Phase 2 gewünscht – welche?

## Bewusst verworfen

- **Home-Bildschirm-Widget wie bei TimeTree** (16.11.2026): Für Web-Apps auf dem iPhone nicht möglich. Alternative wäre ein Kalender-Abo-Link für den Apple-Kalender (dessen Widgets) gewesen – Noah hat sich dagegen entschieden.

## Bekannte Grenzen der neuen Funktionen

- ICS-Import: Wiederholungen wie „jeder 2. Dienstag im Monat“ werden nur als erster Termin übernommen; Erinnerungen aus der Datei werden nicht übernommen.
