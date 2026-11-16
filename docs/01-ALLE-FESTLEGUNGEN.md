# Alle Festlegungen zu Zuhause

Stand: 16. November 2026. Grundlage: ursprünglicher Masterprompt, spätere ausdrückliche Nutzerangaben, bestätigte Überarbeitung der persönlichen Bereiche und der tatsächlich vorhandene Code. Dieses Dokument trennt fachliche Vorgaben von technischen Implementierungsentscheidungen und offenen Fragen.

## 1. Zweck, Nutzer und verbindliche Korrekturen

1. Die App heißt **Zuhause** und organisiert den gemeinsamen Familienalltag.
2. Die Nutzer sind **Noah und Charleen**. Die Hündin heißt **Lou**.
3. Die ursprüngliche Bezeichnung „meine Freundin Shalin“ im Masterprompt wurde durch die später ausdrücklich genannten Nutzer Noah und Charleen ersetzt.
4. Persönliche Oberflächen sollen mit Namen bezeichnet werden, nicht nur als „Freundin“, „Person 1“ oder „Person 2“. Interne technische Schlüssel dürfen generisch bleiben.
5. Die aktuelle Codeschreibweise ist „Charleen“. In der neuesten Exportanfrage steht beispielhaft „Charlene“. Eine endgültige Änderung der Schreibweise wurde nicht ausdrücklich bestätigt; im Export bleibt der tatsächliche letzte Code unverändert. Falls „Charlene“ eine beabsichtigte Korrektur ist, muss das neue Werkzeug die Oberfläche konsistent umbenennen.
6. Als Adresse wurde vom Nutzer **Am Fürstenbrünnchen, Bergisch Gladbach** (vollständige Adresse bewusst nicht im öffentlichen Repository) angegeben.
7. Die frühe Angabe „Bergisch Gladbach, 51491“ im Masterprompt ist durch diese spätere vollständige Nutzeradresse überholt.
8. Die Abfalldatenquelle ordnet die bestätigte Straße der Kennung `284318` und dem Bezirk `2a2` zu. Die Quelle führte bei der Recherche eine abweichende Postleitzahl `51427`; deshalb wurde die Straßenkennung verwendet. Die Nutzeradresse wurde nicht eigenmächtig umgeschrieben.
9. Standortbezogene automatische Inhalte sollen für diesen Haushalt eingerichtet sein. Sensible Finanz- und Dokumentdaten gehören nicht in den öffentlich ausgelieferten Quelltext.

## 2. Grundregeln der Weiterentwicklung

1. Die bestehende App weiterentwickeln; kein unnötiger kompletter Neubau.
2. Vorhandenes Erscheinungsbild möglichst erhalten.
3. Bedienung auf dem iPhone besonders einfach gestalten; Desktopnutzung ebenfalls ermöglichen.
4. Beide Personen sollen dauerhaft gespeicherte Daten und Änderungen gemeinsam sehen.
5. Einstellungen, Kategorien, Materialbestände und Vorlagen möglichst ohne Programmierung pflegen können.
6. Nur nützliche Funktionen hinzufügen und komplizierte, unnötige Abläufe vermeiden.
7. Vor Änderungen vorhandene Struktur und Datenhaltung prüfen.
8. Bereits abgeschlossene fachliche Grundsatzplanung nicht ständig erneut erfragen.
9. Nur tatsächlich fehlende Informationen gezielt erfragen.
10. Der Nutzer hat selbstständiges, gründliches und strukturiertes Weiterarbeiten gewünscht, weil er mit den technischen Einzelheiten wenig vertraut ist.
11. Umsetzung und Veröffentlichung sollten über Sites erfolgen, soweit technisch möglich.
12. Funktionen nicht als vollständig fertig darstellen, bevor sie implementiert und angemessen getestet sind.
13. Den Masterprompt als Arbeitsgrundlage weiterführen, einschließlich noch nicht implementierter Anforderungen.
14. Der Nutzer möchte jetzt mit einem anderen Werkzeug weiterarbeiten; der vollständig aktuelle Quellstand und alle Entscheidungen sollen erhalten bleiben.

## 3. Drei klar erkennbare Hauptbereiche

1. **Gemeinsam**: gemeinsamer Familienbereich.
2. **Noah**: eigene Oberfläche für Noah, insbesondere Montage und Arbeitsalltag.
3. **Charleen**: eigene Oberfläche für Charleen, insbesondere Studium und Persönliches.
4. Die Trennung dient der Übersicht, nicht der Geheimhaltung.
5. Beide Personen dürfen sämtliche Bereiche und Informationen des gemeinsamen Haushalts einsehen.
6. Die persönlichen Bereiche sollen unabhängig voneinander gestaltet und verwaltet werden können.
7. Spätere ausdrückliche Rückmeldung: Eine bloße Sammlung persönlicher Funktionen innerhalb der allgemeinen Oberfläche reicht nicht. Jeder soll eine wirklich eigene Benutzeroberfläche und einen klaren Einstieg bekommen.
8. Der bestätigte neue Aufbau verwendet dauerhaft erkennbare Einstiege „Gemeinsam“, „Noah“ und „Charleen“.
9. Noahs eigene Startseite stellt Montagevorbereitung und offene Montageaufträge in den Mittelpunkt.
10. Charleens eigene Oberfläche wird zunächst mit Studium, Aufgaben, Notizen und Kategorien bereitgestellt. Die weitere konkrete Ausgestaltung soll später mit ihr detaillierter besprochen werden.
11. Innerhalb der persönlichen Bereiche darf die Oberfläche mehr Platz und mehr fachliche Tiefe haben als die kompakte gemeinsame Startseite.
12. Der Nutzer hat ausdrücklich größere Eingabefelder und klarere Aktionen begrüßt.
13. Die zuletzt überarbeitete Oberfläche wurde als erste Fassung zum eigenen Ausprobieren akzeptiert. Daraus folgt keine endgültige Abnahme aller Details oder sämtlicher Funktionen.

## 4. Gemeinsame Startseite

Die verbindliche Reihenfolge lautet:

1. Heute: Kalender und anstehende Termine.
2. Wetter.
3. Gemeinsame Aufgaben.
4. Gemeinsame Einkaufsliste.
5. Müllabfuhr.
6. Demnächst wichtig.

Weitere Regeln:

- Innerhalb weniger Sekunden erkennbar machen, was heute ansteht.
- Übersichtlich bleiben und nicht zur vollständigen Verwaltungsoberfläche anwachsen.
- Persönliche Schnellzugriffe auf Noahs Montage und Charleens Studien-/Persönlichkeitsbereich anbieten.
- Finanzen ausdrücklich in einem eigenen Menübereich führen, nicht auf der gemeinsamen Startseite.
- Frühere Finanz-/Steuerübersichtskarten auf der Startseite sind kein Bestandteil des aktuellen Soll-Aufbaus.
- Eine aktuelle oder bevorstehende Abholung soll insbesondere am Vortag und am Abfuhrtag sichtbar sein.
- Nicht benötigte alte Dekorationen oder Informationskarten dürfen die verlangte Reihenfolge nicht verdrängen.

## 5. Kalender

1. Alle Termine beider Personen sichtbar halten.
2. Ansichten bzw. Filter für alle Termine, Noahs Termine und Charleens Termine anbieten.
3. Gemeinsame und persönliche Termine farblich unterscheiden.
4. Änderungen zwischen den Nutzern synchronisieren.
5. Tierarztbesuche, Impfungen und andere Termine für Lou im normalen Kalender führen, nicht in einer separaten Dokumenten-Terminverwaltung.
6. Die vorhandene technische Kalenderlösung enthält zusätzlich Monats-, Wochen- und Agendaansicht, Teilnehmer, Farblabel, Wiederholungen, Serienausnahmen, persönliche Erinnerungen, Ort, Link und Notiz. Diese bestehenden Funktionen sollen bei weiteren Umbauten nicht versehentlich verloren gehen.
7. Die generischen internen Kalenderkennungen `shared`, `person1` und `person2` sind technische Schlüssel. In der Oberfläche sollen Namen erscheinen.
8. Serienbearbeitung soll einzelne Termine bzw. eine Serie behandeln können; die vorhandenen Dialoge und Datenmodelle sind zu berücksichtigen.

## 6. Haushaltsaufgaben

Jede Aufgabe soll enthalten:

- Titel.
- Optionale Beschreibung.
- Zuständigkeit: Noah, Charleen oder beide.
- Echtes Fälligkeitsdatum.
- Erledigt-Status.
- Optional eine Wiederholung.

Verhaltensregeln:

1. Alle Aufgaben sind für beide sichtbar.
2. Offene Aufgaben bleiben auf der Startseite sichtbar, auch nach überschrittener Fälligkeit.
3. Überfällige Aufgaben deutlich kennzeichnen.
4. Erledigte Aufgaben bleiben am Tag des Abhakens sichtbar.
5. Erst am Folgetag verschwinden sie von der Startseite.
6. Im Aufgabenverlauf bleiben sie erhalten.
7. Eine unerledigte alte Wiederholung darf die nächste Aufgabe nicht verhindern.
8. Die alte unerledigte Instanz bleibt als überfällig bestehen.

Wiederholungsoptionen:

- Täglich.
- Wöchentlich.
- Alle zwei Wochen.
- Monatlich.
- Benutzerdefiniert mit Intervall und Einheit.

Später technisch präzisiert bzw. korrigiert:

- Wiederholungen dürfen keine Duplikate erzeugen.
- Monatsaufgaben sollen nach einem kurzen Monat zum ursprünglichen Monatstag zurückkehren, soweit der Zielmonat diesen Tag besitzt.
- Ein Tageswechsel soll die Anzeige aktualisieren, auch wenn kein neuer Datensatz aus der Cloud kommt.
- Lokal gespeicherte Datums- und Erledigtinformationen dürfen nicht durch eine reine UTC-Zeichenfolgenprüfung am falschen lokalen Tag verschwinden.
- Ein früherer technischer Änderungsauftrag schlug eigenständige Tabellen für Aufgabenserien und Aufgabeninstanzen sowie serverseitige Erzeugung mindestens 35 Tage im Voraus vor. Dies ist als nicht vollständig umgesetzter Architekturvorschlag erhalten, nicht als bereits fertige Eigenschaft der aktuellen App.
- Der ursprüngliche Masterprompt verlangt die Sichtbarkeit offener Aufgaben allgemein. Ein früheres technisches Papier beschränkte die Startseite auf bis heute fällige Aufgaben. Der aktuelle Code folgt der breiteren Sichtbarkeit aller offenen Aufgaben.

## 7. Gemeinsame Einkaufsliste

1. Eine gemeinsame Liste für beide Personen.
2. Freie Texteingabe.
3. Möglichst Spracheingabe; sie ist eine Ergänzung und darf die normale Eingabe nicht ersetzen.
4. Mengen und Artikel möglichst automatisch erkennen, beispielsweise „2 × Milch“, „1 × Brot“, „6 × Bananen“.
5. Nach Supermarktbereichen automatisch zuordnen.
6. Die Reihenfolge ist fest:
   1. Obst und Gemüse.
   2. Tiefkühlprodukte.
   3. Kühlprodukte.
   4. Trockenwaren.
   5. Getränke.
   6. Haushaltsartikel.
   7. Sonstiges.
7. Artikel abhaken können.
8. Änderungen zwischen beiden Nutzern synchronisieren.
9. Keine unterschiedlichen Supermarktprofile.
10. Keine Produktpreisvergleiche zwischen Supermärkten.

## 8. Müllabfuhr und Erinnerungen

1. Termine möglichst automatisch vom zuständigen Entsorger übernehmen.
2. Dafür vorhandene Schnittstelle oder importierbaren Kalender nutzen.
3. Maßgeblich ist die später vollständig angegebene Straße des Haushalts.
4. Restmüll, Papier, Gelbe Tonne und Biomüll berücksichtigen.
5. Termine möglichst automatisch aktualisieren.
6. Abholung am Vortag und Abfuhrtag auf der Startseite anzeigen.
7. **Beide Nutzer am Vortag um 15:00 Uhr** per Push erinnern.
8. Zeitzone für diese Erinnerung ist Europe/Berlin.
9. Im vorhandenen Erinnerungscode werden mehrere gleichzeitig abgeholte Tonnen in einer gemeinsamen Nachricht zusammengefasst.
10. Jeder Nutzer bzw. jedes Gerät muss die vom Betriebssystem geforderte Push-Erlaubnis selbst erteilen. Das Vorhandensein des Servercodes ist kein Nachweis tatsächlicher Zustellung auf beiden iPhones.
11. Die aktuelle Umsetzung nutzt die RegioIT-Abfall-App-Schnittstelle für Bergisch Gladbach mit Straßenkennung `284318` und dem Bezirk `2a2`.

## 9. Gemeinsame Finanzen und Budget

1. Eigener Menübereich für Finanzen.
2. Ein gemeinsames Haushaltskonto als fachlicher Hintergrund und ein gemeinsames Budget.
3. Keine getrennten persönlichen Budgets.
4. Ein fester monatlicher Budgetbetrag, jederzeit für den laufenden Rahmen anpassbar.
5. Fixkosten automatisch berücksichtigen.
6. Eingetragene Ausgaben automatisch abziehen.
7. Restbudget automatisch in den Folgemonat übertragen.
8. Auch negative Restbeträge weiterführen.
9. Vergangene Monate nachvollziehbar und unverändert erhalten.
10. Rechnerisches Budget und tatsächlichen Bankkontostand nicht verwechseln.
11. Die vorhandene App führt keine Bankanbindung durch.

Reihenfolge der Finanzübersicht:

1. Verfügbar in diesem Monat.
2. Übertrag aus Vormonat.
3. Fixkosten dieses Monats.
4. Anschließend die Ausgaben als chronologische Liste.

Spätere Umsetzungskorrekturen:

- Monatsübertrag darf keinen manuellen Abschluss voraussetzen.
- Vergangene Monate werden beim Monatswechsel bzw. nächsten Öffnen mit Ausgaben- und Fixkosten-Schnappschuss geschlossen.
- Spätere Änderungen am laufenden Budget dürfen historische Schnappschüsse nicht neu berechnen.
- Auch negative Salden berücksichtigen.
- Historische Monate über eine Monatsauswahl ansehen können.
- Buchungen in bereits abgeschlossene Monate nicht unbemerkt zulassen.
- Geldbeträge auf Cent runden.

## 10. Kassenbon-Scanner

1. Mit der iPhone-Kamera Kassenbons fotografieren können.
2. Möglichst automatisch Geschäft erkennen.
3. Einkaufsdatum erkennen.
4. Gekaufte Artikel erkennen.
5. Gesamtbetrag erkennen.
6. Erkannte Werte vor dem Speichern zur Kontrolle anzeigen.
7. Nutzer bestätigt oder korrigiert die Werte.
8. Erst die bestätigte Ausgabe belastet das Haushaltsbudget.
9. In der normalen Finanzliste nur Geschäft, Datum und Gesamtbetrag eines Einkaufs anzeigen.
10. Einzelartikel im Beleg nachvollziehbar behalten, nicht als einzeln kategorisierte Haushaltsausgaben verbuchen.
11. Belegbild geschützt ablegen.
12. Ein fehlgeschlagener Beleg-Upload darf keine scheinbar vollständig gespeicherte Ausgabe erzeugen.
13. OCR-Ergebnisse dürfen nicht ungeprüft als zuverlässig dargestellt werden; echte Fotos sind noch praktisch zu prüfen.

## 11. Sparanalyse

1. Eigener Unterpunkt bzw. klar erkennbarer Bereich „Sparanalyse“ innerhalb der Finanzen.
2. Monatliche Ausgabenentwicklung darstellen.
3. Vergleich mit vergangenen Monaten.
4. Ausgaben nach Geschäften zeigen.
5. Einfache, nachvollziehbare Spartipps aus den vorhandenen Ausgaben ableiten.
6. Optional ein Sparziel.
7. Möglichst automatisch aktualisieren.
8. Keine Produktpreisvergleiche zwischen Supermärkten.

## 12. Dokumentenverwaltung

Vier Hauptordner:

1. Gemeinsam.
2. Noah.
3. Charleen.
4. Lou.

Weitere Vorgaben:

- Innerhalb der Ordner Kategorien anlegen und bearbeiten können.
- Beispiele: Versicherungen, Verträge, Rechnungen, Steuerunterlagen, Sonstige Dokumente.
- Lou-Ordner beispielsweise für Impfpass, Tierarztrechnungen und Versicherungsunterlagen.
- Tierarzttermine bleiben im Kalender.
- Suche innerhalb einer Kategorie.
- Gesamtsuche über alle Dokumente.
- Dokumentname und durch OCR erkannter Inhalt sollen durchsuchbar sein.
- Die Originaldatei muss erhalten bleiben.
- Zugriffsschutz, sichere Speicherung und Datenschutz berücksichtigen.
- Ordnertrennung bedeutet keine privaten Geheimordner zwischen den beiden Haushaltsmitgliedern.

## 13. Integrierter Dokumentenscanner

Gewünschter vollständiger Ablauf:

1. Dokument mit der iPhone-Kamera erfassen.
2. Seite automatisch zuschneiden und bei Bedarf korrigieren.
3. Mehrere Seiten zu einem PDF zusammenfassen.
4. Dokument benennen.
5. Hauptordner und Kategorie auswählen.
6. PDF geschützt speichern.
7. Gescannten Seiten automatisch durchsuchbaren OCR-Text zuordnen.
8. Originaldateien behalten.

Abgrenzung:

- Ein Mehrfach-Dateiupload mit PDF-Erzeugung ist noch kein vollständig abgenommener mehrseitiger Kamera-Scanner.
- Die derzeitige einfache Rand-/Kontrastkorrektur ist keine zuverlässige Erkennung beliebig schräger Dokumentkanten und keine vollständige Perspektivkorrektur.
- Die App soll keine Inhalte abschneiden, nur um einen automatischen Zuschnitt behaupten zu können.
- Der zuletzt eingebaute Zuschnitt verzichtet bei unsicherer Erkennung auf das Beschneiden.

## 14. Noahs Montagebereich: ursprüngliche Vorgaben

1. Für den Arbeitsalltag schnell bedienbar.
2. Ziel: morgens innerhalb von ein bis zwei Minuten eine fertige Packliste vorbereiten.
3. Frei bearbeitbare Montagevorlagen, zum Beispiel Fenstermontage.
4. Maschinen selbst hinzufügen und verwalten können.
5. Verbrauchsmaterialien selbst anlegen und verwalten können.
6. Kategorien verändern können.
7. Vorlagen erstellen und bearbeiten können.
8. Materiallisten verwalten können.
9. Maschinen unterscheiden in „Immer im Montagewagen“ und „Extra einpacken“.
10. Extra-Maschinen morgens zusätzlich aus der Werkstatt holen.
11. Helfer-Packliste hauptsächlich auf zusätzliche Maschinen, Verbrauchsmaterial und offene Nachfüllartikel konzentrieren.
12. Vollständige benötigte Ausrüstung bei Bedarf anzeigen können.
13. Übersichtliche PDF-Packliste erzeugen.
14. Keine Rückgabe-Erinnerungen für Maschinen.

## 15. Noahs Montagebereich: später ausdrücklich bestätigte Neugestaltung

Ausgangspunkt der Nutzerkritik:

- Die alte Montageoberfläche war zu unübersichtlich.
- Es war nicht klar genug, wie eine Vorlage bearbeitet wird.
- Es war nicht klar genug, wie Material für den aktuellen Auftrag ergänzt wird.
- Was heute gemacht werden muss, soll verständlich im Auftrag stehen.
- Die persönlichen Oberflächen dürfen größer und fachlich ausführlicher sein.

Bestätigter neuer Aufbau:

1. Noah erhält eine eigene Startseite mit offenen Montageaufträgen.
2. **Vorlage und konkreten Auftrag trennen.**
3. Eine Vorlage enthält übliche Maschinen, Materialien, Mengen, Arbeitsschritte und Hinweise einer Montageart.
4. Eine klar beschriftete Aktion „Auftrag aus Vorlage vorbereiten“ legt daraus einen konkreten Auftrag an.
5. Ein Auftrag bekommt einen Namen und einen Montagetag.
6. Ein leerer Auftrag ohne Vorlage ist ebenfalls möglich.
7. Die Vorlage wird in den Auftrag kopiert.
8. Änderungen am Auftrag gelten zunächst nur für diesen Auftrag.
9. Spätere Änderungen an einer Vorlage verändern bestehende Aufträge nicht.
10. Vorlagen über einen ausdrücklich beschrifteten Button „Vorlage bearbeiten“ ändern; nicht hinter einem unklaren kleinen Symbol verstecken.
11. Vorlagen, aktueller Auftrag und Ausrüstung in getrennten Reitern führen.
12. Die vollständige Bestandsverwaltung aus dem täglichen Vorbereitungsablauf herausnehmen.
13. Im Tagesablauf die Fragen beantworten: **Was wird gemacht? Was muss mit? Ist alles vorbereitet?**
14. Arbeitsschritte für den konkreten Auftrag ergänzen und abhaken können.
15. Material für den Auftrag auswählen oder frei ergänzen können.
16. Die Mengen pro Auftrag ändern können.
17. Vorlagen dürfen eigene Standardmengen je Material haben.
18. Zusätzliche Maschinen je Auftrag auswählen können.
19. Die Packliste unterscheidet automatisch Wagenbestand und zusätzlich Einzupackendes.
20. Abgehakte Packpunkte dauerhaft im Auftrag speichern.
21. Hinweise für den Auftrag speichern.
22. Den Auftrag als vorbereitet markieren, abschließen und wieder öffnen können; diese Statusaktionen sind Teil des zuletzt implementierten Arbeitsablaufs.
23. Eine Auftragssammlung nur über eine ausdrückliche zusätzliche Aktion als neue Vorlage übernehmen.
24. Große Felder, klare Beschriftungen und gut erreichbare Buttons.
25. Sprünge zu Arbeit, Material und Packliste anbieten.
26. Die PDF-Packliste soll die tatsächlichen Daten des gewählten Auftrags einschließlich Mengen, Nachfüllmarkierungen, Arbeitsschritten und Hinweisen verwenden.
27. Bereits angelegte Aufträge sollen ihre gespeicherte Ausrüstung behalten, wenn später Katalogeinträge entfernt werden.
28. Die letzten Punkte zu Status, gespeicherten Haken, Standardmengen und Auftragsschnappschüssen konkretisieren den bestätigten Ablauf. Sie sind keine nachträglich erfundene Rückgabeverwaltung.

## 16. Charleens persönlicher Bereich

1. Eigene Oberfläche mit eigenem Einstieg.
2. Studienaufgaben verwalten.
3. Persönliche Aufgaben und Notizen verwalten.
4. Persönliche Termine über den Kalender erreichbar machen.
5. Eigene Dokumente über den Dokumentbereich erreichbar machen.
6. Weitere eigene Kategorien anlegen und bearbeiten können.
7. Änderungen und Erweiterungen möglichst ohne Programmierung.
8. Unabhängig von Noahs Montagebereich gestalten.
9. Beide Personen behalten Einsicht.
10. Der Nutzer hat ausdrücklich gesagt, dass die konkrete Ausgestaltung später noch detaillierter besprochen werden kann. Ein bestimmter vollständiger Stundenplan-, Noten-, Lernplan- oder frei konfigurierbarer Modulbaukasten wurde nicht abschließend festgelegt.

## 17. Anmeldung, Haushaltszugehörigkeit und Sichtbarkeit

1. E-Mail und Passwort eines eigenen App-Kontos verwenden können.
2. **Keine zusätzliche ChatGPT-Anmeldung für die Benutzung von Zuhause.**
3. Der Nutzer hat klargestellt, dass nur ein gemeinsamer ChatGPT-Account vorhanden ist.
4. Zwei ChatGPT-Konten sind für die App nicht erforderlich.
5. Zwei eigene App-Konten können zum selben Haushalt gehören.
6. Eine Person richtet den Haushalt ein; die zweite kann über den Einladungscode beitreten.
7. Die Sites-Zugangssperre wurde auf ausdrücklichen Nutzerwunsch entfernt.
8. Aktuelle Sites-Einstellung: `public`, damit der Seitenaufruf direkt die App erreicht.
9. „Public“ bezeichnet den Seitenaufruf und die Auslieferung der Webdateien. Die App soll Haushaltsdaten weiterhin nur angemeldeten Haushaltsmitgliedern zugänglich machen.
10. Die Datenbank verwendet Supabase Auth und Row Level Security; Dokumentdateien werden über einen geschützten Storage-Bucket und zeitlich begrenzte URLs geöffnet.
11. Private Server-Schlüssel, Passwörter und Sitzungstoken gehören nicht in Browserdateien, ZIP-Quellcode oder frei zugängliche Konfiguration.
12. Der im Browser benötigte veröffentlichbare Supabase-Schlüssel bleibt ein öffentlicher Projektschlüssel; der Schutz muss durch serverseitige Berechtigungen erfolgen.
13. Eine komplette neue Konten-/Passwortlösung wurde nicht beauftragt; die bestehende App-Anmeldung soll weiterverwendet werden.

## 18. Speicherung, Synchronisierung und technische Grundregeln

1. Daten dauerhaft speichern und zwischen beiden Nutzern synchronisieren.
2. Bestehende Nutzerdaten erhalten und keine unnötige Neuanlage eines Haushalts verlangen.
3. Gleichzeitige Änderungen nicht still überschreiben.
4. Änderungen bei Netzproblemen geräte- und haushaltsbezogen zwischenspeichern.
5. Erkennbar machen, wenn Änderungen nur lokal liegen.
6. Nach Wiederverbindung erneut speichern.
7. Bei Löschungen verhindern, dass gelöschte Einträge durch den Abgleich wieder auftauchen.
8. Änderungen verschiedener Felder unabhängig zusammenführen.
9. Den zugrunde liegenden Stand für Offline-Abgleiche aufbewahren.
10. Beim Abmelden kontobezogene lokale Zustände entfernen und Geräte-Push deaktivieren.
11. Bestehende Kalenderdaten nicht beim Speichern anderer Bereiche überschreiben.
12. Clientseitige Texte vor Einfügen in HTML maskieren.
13. Sicherheit nicht allein auf unsichtbare UI-Elemente oder eine vorgeschaltete Hosting-Anmeldung stützen.
14. Der normalisierte Aufgabenentwurf mit getrennten Tabellen, Einzeloperationen, Client-Operationskennungen und serverseitiger Materialisierung bleibt ein dokumentierter, noch nicht fertig integrierter technischer Ausbau.
15. Eine neue Technologie oder ein neues Hosting darf bei der Weiterarbeit verwendet werden; die jetzt exportierten Dateien sind jedoch eine unveränderte Übergabe des vorhandenen Stands und keine Migration.

## 19. Design und Farben

Fachlich vereinbart wurde: vorhandenes Design möglichst erhalten, ruhig und übersichtlich bleiben, iPhone-Bedienbarkeit priorisieren, persönliche Bereiche klarer unterteilen und ihnen größere Felder geben. Eine komplett neue Markenwelt oder eine vom Nutzer vorgegebene exakte Hex-Palette wurde nicht verlangt.

Die folgenden Werte sind der **aktuelle implementierte Designstand**, der für die Fortsetzung mitübergeben wird:

| Rolle / CSS-Wert | Farbe |
|---|---|
| Haupttext `--ink` | `#20251f` |
| Zurückhaltender Text `--muted` | `#72786e` |
| Papier-/Seitenhintergrund `--paper` | `#f8f7f2` |
| Weiß `--white` | `#ffffff` |
| Salbei `--sage` | `#839681` |
| Dunkles Salbei / Hauptaktionen `--sage-dark` | `#536b57` |
| Helles Salbei `--sage-soft` | `#e6ebe0` |
| Terrakotta `--clay` | `#bd7868` |
| Helles Terrakotta `--clay-soft` | `#f4e3de` |
| Gold `--gold` | `#b78b47` |
| Helles Gold `--gold-soft` | `#f5ead6` |
| Blau `--blue` | `#6f8da2` |
| Helles Blau `--blue-soft` | `#e1eaf0` |
| Violett `--violet` | `#817c9f` |
| Linien `--line` | `#e5e4dc` |
| PWA-Theme | `#eef0e7` |
| Ergänzendes Funktionsgrün | `#5f6d59` |
| Funktionslinien | `#e5e3dc` |
| Funktionshintergrund | `#f7f6f1` |
| Überfällig-/Negativfarbe | `#a54d43` |
| Workspace-Akzent | `#446759` |
| Noahs Avatar-Hintergrund / Text | `#dce8ee` / `#365c75` |
| Charleens Avatar-Hintergrund / Text | `#f1dcd5` / `#925d52` |

Weitere aktuelle Gestaltungseigenschaften:

- Warme helle Hintergründe mit Grün-, Blau- und Terrakottaakzenten.
- Abgerundete Karten, Grundradius `22px`, einige persönliche Karten größer abgerundet.
- Dezente Schatten; Basiswert `0 18px 50px rgba(56,65,52,.09)`.
- Überschriften überwiegend Georgia bzw. Serif-Fallback.
- Fließtext und Formulare: Inter, Apple-Systemschrift, BlinkMacSystemFont, Segoe UI, sans-serif; Inter wird nicht als eigene lokale Schriftdatei mitgeliefert.
- Große persönliche Eingabefelder, typischerweise mindestens `52px` hoch und `16px` Schriftgröße.
- Große Hauptaktionen für die Montage, typischerweise mindestens `54px` hoch.
- Desktop-Seitenleiste; auf kleinen Displays untere Navigation.
- Dauerhafte Bereichsauswahl Gemeinsam / Noah / Charleen.
- Unterschiedliche visuelle Akzente für Noah und Charleen.
- Responsive Anpassungen in den vorhandenen CSS-Dateien; relevante Breakpoints sind unter anderem 1100, 1050, 780, 760 und 430 Pixel.
- Haus-Icon mit zwei dargestellten Haushaltsmitgliedern; SVG sowie normale und maskierbare PNG-Varianten sind Bestandteil des Codes.

## 20. Vorhandene Zusatzbereiche aus der älteren Steuer-App

Die bestehende Anwendung enthält weiterhin Steuer-/ELSTER-Vorbereitung, Einnahmen-/Nebengewerbeübersicht, Arbeitstage, Versicherungen, Vertrags- und Einstellungsdialoge. Diese vorhandenen Bausteine wurden nicht pauschal zur voll funktionsfähigen Steuer-App erklärt.

- Einnahmen, bestimmte Ausgaben und Steuer-Checklisten sind im Code vorhanden.
- Eine tatsächliche ELSTER-Übermittlung oder ein offizieller ELSTER-Dateiexport wurde nicht umgesetzt und nicht als fertig beauftragt bestätigt.
- Der vorhandene JSON-Export ist ausdrücklich eine Kontrolldatei, keine ELSTER-Datei.
- Vertragserinnerungen und ein vollständiges Einstellungszentrum sind in älteren Dialogtexten angekündigte spätere Erweiterungen, keine bereits abgeschlossenen Funktionen.
- Die neu verlangte gemeinsame Finanzübersicht bleibt ein gemeinsames Budget, auch wenn in alten Steuerformularen eine zahlende Person erfasst werden kann.

## 21. Automatische Inhalte aus dem Altbestand

- Die aktuelle Hintergrundfunktion enthält Abfalltermine, Fußballtermine und gute Nachrichten.
- Der im Code hinterlegte Fußball-Fallback ist SC 27 Bergisch Gladbach, Teamkennung `011MIFBN30000000VTVG0001VTR8C1K7`; diese Integration war bereits im Bestand vorhanden.
- Good News wird weiterhin serverseitig synchronisiert; die frühere Karte auf der Startseite wurde zugunsten der gewünschten Startseitenreihenfolge ausgeblendet.
- Diese Integrationen sind vorhandener Kontext. Der neue Masterprompt verlangt keine zusätzliche öffentliche Nachrichten-App oder Erweiterung der Fußballfunktionen.

## 22. Was ausdrücklich nicht gemacht werden soll

1. Keine unnötige Neuerstellung der gesamten App.
2. Keine erneute allgemeine Grundsatzplanung zu bereits entschiedenen Anforderungen.
3. Keine unnötigen Funktionen und komplizierten Abläufe.
4. Keine Finanzübersicht auf der gemeinsamen Startseite.
5. Keine getrennten persönlichen Haushaltsbudgets.
6. Keine Verwechslung von Budget und Bankkontostand.
7. Keine unterschiedlichen Supermarktprofile.
8. Keine Produktpreisvergleiche zwischen Supermärkten.
9. Keine separate Kategorisierung jedes Bonartikels als einzelne Haushaltsausgabe.
10. Keine Rückgabe-Erinnerungen für Maschinen.
11. Keine Geheimhaltung zwischen den beiden Haushaltsmitgliedern durch persönliche Ordner oder Oberflächen.
12. Keine Tierarzt-Terminverwaltung im Dokumentenbereich statt im Kalender.
13. Keine unbeabsichtigte Änderung einer wiederverwendbaren Montagevorlage bei Anpassung eines heutigen Auftrags.
14. Keine nachträgliche Veränderung bestehender Aufträge durch Vorlagenänderungen.
15. Kein erneutes Anlegen absichtlich gelöschter Beispieldaten.
16. Keine Verpflichtung zu einer zusätzlichen ChatGPT-Anmeldung oder zu zwei ChatGPT-Konten.
17. Keine Veröffentlichung privater Server-Schlüssel oder Passwörter im Frontend.
18. Keine Behauptung „alles fertig“, solange Implementierung oder erforderliche Tests fehlen.
19. Keine Übergabe eines alten Stands vom 8. November als neuester Stand.
20. Bei dieser Übergabe keine stillen Codekorrekturen oder Migrationen: der aktuelle Code soll vollständig und unverändert erhalten bleiben.

## 23. Noch nicht abschließend festgelegt oder zu prüfen

1. Ob die neueste beispielhafte Schreibweise „Charlene“ eine beabsichtigte Namenskorrektur ist; aktueller Code: Charleen.
2. Die weitere konkrete fachliche Gestaltung von Charleens eigener Oberfläche.
3. Ob die neue Montageoberfläche nach dem persönlichen Ausprobieren weiter angepasst werden soll.
4. Vollständige Abnahme auf zwei echten iPhones einschließlich gleichzeitiger Änderungen und Offline-/Online-Wechsel.
5. Tatsächliche Push-Zustellung an beide Geräte.
6. Vollständiger mehrseitiger iPhone-Kamera-Scanner mit sicherer Kanten- und Perspektivkorrektur.
7. OCR-Qualität bei echten Rechnungen, Versicherungsunterlagen und Kassenbons.
8. Endgültige Integration des früheren normalisierten Aufgabenmodells und serverseitiger Wiederholungserzeugung.
9. Vollständiger Sicherheits-/Berechtigungstest mit einem fremden Haushalt, nicht nur ohne Anmeldung.
10. Falls das andere Werkzeug Hosting oder Backend migriert: Umgang mit bestehenden Konten, Dokumenten, Datenbankinhalten, Cron-Secrets, Push-Schlüsseln, Domain und Service-Worker-Cache. Dafür wurde in dieser Übergabe keine neue Migrationsentscheidung getroffen.
