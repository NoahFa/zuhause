# Was umgesetzt ist und was noch offen ist

Stand: 16. November 2026. Bezogen auf App-Fassung v10, Commit `29ec090dcad61af87a4b0a3a81d35e57ef3f1c86` und Sites-Version 8.

## Kurze Liste: bereits im Code

- Drei dauerhaft erreichbare Bereiche Gemeinsam, Noah und Charleen; eigene Startseiten für Noah und Charleen.
- Gemeinsame Startseite mit Heute, Wetter, Aufgaben, Einkaufsliste, Müllabfuhr und Demnächst; keine Finanzkarte auf dieser Startseite.
- Eigene App-Anmeldung mit E-Mail und Passwort, Registrierung sowie Haushalt anlegen oder beitreten. Zusätzliche ChatGPT-Zugangssperre entfernt.
- Familienkalender mit gemeinsamen und persönlichen Kalendern, Farben, Monats-/Wochen-/Agendaansicht, Formularen, Serien, Teilnehmern, Erinnerungsdaten und Synchronisierungsbausteinen.
- Haushaltsaufgaben mit Beschreibung, Zuständigkeit, echtem Datum, Erledigt-Zeitpunkt, Überfällig-Markierung, Verlauf und allen verlangten Wiederholungsintervallen.
- Gemeinsame Einkaufsliste mit Mengenparser, automatischer Bereichszuordnung, fester Sortierung, Abhaken und optionaler browserabhängiger Spracheingabe.
- Automatischer Abfallimport für die konfigurierte Straße; Startseitenanzeige und geschützte Hintergrundfunktionen für Import und Erinnerungen.
- Gemeinsames Monatsbudget, Fixkosten, Ausgabenabzug, automatische positive/negative Überträge, historische Monats-Schnappschüsse und Monatsauswahl.
- Kassenbon-OCR mit Kontrollformular vor Bestätigung; geschützte Belegablage und Speicherung von Einzelartikeln am Einkauf.
- Sparanalyse mit sechs Monatswerten, Ausgaben nach Geschäften, einfachen Tipps und optionalem Sparziel.
- Vier Dokumentordner, Kategorien anlegen/umbenennen, globale oder kategoriebeschränkte Suche, OCR-Suchtext, Datei-/Kameraeingabe, Mehrbild-PDF und Originalfotoablage.
- Noahs neue Montageaufträge mit kopierten Vorlagendaten, auftragsbezogenen Mengen, Arbeitsschritten, Maschinenauswahl, Hinweisen, gespeicherten Packhaken und Status.
- Montagevorlagen mit eigenen Standardmengen und Arbeitsschritten; getrennte Bestandsverwaltung; Auftrag ausdrücklich als neue Vorlage übernehmen.
- PDF-Packliste mit tatsächlichen Auftragsdaten; zusätzlicher Wagen-/Werkstattunterscheidung, Nachfüllartikeln, Arbeitsschritten und Hinweisen.
- Charleens Aufgaben-/Notizliste, eigene Kategorien sowie Kalender- und Dokumentzugriffe.
- Revisionen und Drei-Wege-Abgleich für den gemeinsamen Zustand, kontobezogener lokaler Cache, Offline-Zwischenstand, Retry-Bausteine, Sicherheitsheader und PWA-/Service-Worker-Grundlage.

## Kurze Liste: noch nicht vollständig umgesetzt oder noch nicht abgenommen

- Zuverlässiger Dokumentenscanner mit vollständigem mehrseitigem iPhone-Kameraablauf, Dokumentkantenerkennung und Perspektivkorrektur.
- Qualitätsnachweis für OCR anhand echter Fotos und unterschiedlicher Kassenbons/Dokumente.
- Tatsächliche Push-Zustellung an beide iPhones.
- Vollständiger gleichzeitiger Zwei-Konten-/Zwei-Geräte-Test einschließlich Offline-Konflikten und falscher Haushaltszugehörigkeit.
- Frei erweiterbare persönliche Module für Charleen; konkrete zusätzliche Anforderungen wurden bewusst noch nicht abschließend festgelegt.
- Integration der angelegten normalisierten Aufgabentabellen in das Frontend; serverseitige Materialisierung wiederkehrender Haushaltsaufgaben mindestens 35 Tage im Voraus.
- Vollständiges Vertrags-/Versicherungs-/Arbeitstage-/Einstellungszentrum und eine echte ELSTER-Übertragung. Hier gibt es weiterhin Altbestand, Hinweise und unvollständige Formulare.

## Statusbegriffe

- **Im Code**: die fachliche Funktion ist implementiert. Daraus folgt nicht automatisch ein erfolgreicher Test auf echten iPhones.
- **Teilweise**: wesentliche Bestandteile sind da, eine konkrete Anforderung fehlt oder ist eingeschränkt.
- **Geplant / offen**: keine vollständige Implementation vorhanden oder noch keine abschließende fachliche Ausgestaltung.
- **Nicht abgenommen**: Code kann vorhanden sein, ein erforderlicher praktischer Nachweis fehlt.

## Vollständiger Soll-Ist-Abgleich

| Bereich | Stand | Konkrete Einordnung |
|---|---|---|
| Bestehende App weiterentwickeln | Im Code | Die vorhandene App wurde erweitert. `features.js` ergänzt den Alltagskern, `workspaces.js` die neuen persönlichen Bereiche. Kein vollständiger Framework-Neubau. |
| Drei Hauptbereiche | Im Code, lokal im Browser geprüft | Dauerhafte Umschaltung Gemeinsam / Noah / Charleen, persönliche Übersicht und Navigation. Beide können die Bereiche weiter einsehen. |
| Größere persönliche Oberflächen | Im Code, responsive geprüft | Große Felder, klare Aktionsbeschriftungen, eigener Montage-Arbeitsbereich. Erste Testfassung zur Nutzerbewertung, kein abschließend unveränderliches Design. |
| Reihenfolge gemeinsame Startseite | Im Code, lokal geprüft | Heute → Wetter → Aufgaben → Einkauf → Müll → Demnächst. Eine alte CSS-Regel, die Demnächst mobil versteckte, wurde korrigiert. |
| Finanzen nicht auf Startseite | Im Code | Alte Finanz-/Steuerübersicht dort ausgeblendet; separater Finanzbereich bleibt bestehen. |
| Wetter | Im Code und im Browser geladen | Open-Meteo-Abfrage für feste Koordinaten in Bergisch Gladbach, aktuelles Wetter und drei Tage. Keine frei bedienbare Standortkonfiguration. |
| Persönliche Schnellzugriffe | Im Code | Einstieg in Montage bzw. Charleens Bereich und dauerhafte Bereichsauswahl. |
| Kalenderfilter und Farben | Im Code | Gemeinsamer und zwei persönliche Kalender, auswählbare Sichtbarkeit und Farblabel. Es gibt zusätzlich Monat/Woche/Agenda. |
| Kalender bearbeiten und Serien | Im Code; nicht vollständig geräteübergreifend abgenommen | Datenmodell, Dialoge, Revisionen, Offline-Warteschlange, Serien-/Ausnahmebausteine sind vorhanden. Nicht mit sämtlichen Serienfällen und zwei echten Konten vollständig abgenommen. |
| Lou-Termine im Kalender | Über normalen Kalender möglich | Es gibt keinen separaten vollständigen Lou-Terminmanager; Titel, Kalender und Notiz können dafür verwendet werden. |
| Aufgabenfelder | Im Code und in DOM-Abläufen geprüft | Titel, optionale Beschreibung, Person, echtes Fälligkeitsdatum, Erledigt-Status, Wiederholung. |
| Überfällige Aufgaben | Im Code und geprüft | Offene Aufgaben bleiben sichtbar; fällige alte Aufgaben werden hervorgehoben. |
| Erledigt bis Folgetag und Verlauf | Im Code und teilweise automatisiert geprüft | Erledigte Aufgaben bleiben am Abschlusstag auf der Startseite, später nur noch in der vollständigen Aufgabenliste. Tageswechsel-Aktualisierung vorhanden. |
| Wiederholungsintervalle | Im Code | Täglich, wöchentlich, zweiwöchentlich, monatlich, benutzerdefiniert. Folgetermine hängen nicht vom Erledigen vorheriger Instanzen ab. |
| Wiederholungen auf Server | Geplant / nicht integriert | Die aktuelle Erzeugung läuft im Browser beim Initialisieren/Aktualisieren bis zum aktuellen Tag. Sie läuft nicht als eigener Aufgaben-Cron im Hintergrund. |
| Normalisierte Aufgaben | Teilweise vorbereitet | `task_series` und `task_instances` sind im SQL definiert und wurden produktiv angelegt. Die Oberfläche benutzt weiterhin `app_state.householdTasks`; die Tabellen allein bedeuten keinen abgeschlossenen Umstieg. |
| Einkaufsmengen und Sortierung | Im Code und DOM-geprüft | Mengenparser und Schlüsselwortregeln für die sieben vorgegebenen Bereiche. Das ist regelbasiert, keine universelle Artikelerkennung. |
| Einkauf abhaken / entfernen | Im Code und geprüft | Gemeinsame Zustandsänderung, beim Abgleich werden Löschungen berücksichtigt. |
| Einkauf per Sprache | Im Code, browserabhängig | Web Speech API bzw. WebKit-Variante; verständlicher Hinweis, wenn nicht verfügbar. Kein Nachweis mit realer iPhone-Spracheingabe. |
| Einkauf nachträglich detailliert bearbeiten | Eingeschränkt | Aktuell vor allem hinzufügen, abhaken und löschen; ein vollständiger sichtbarer Editor für Menge und Kategorie eines vorhandenen Einkaufsartikels fehlt. Hilfetext im Altformular verspricht mehr als diese UI bereitstellt. |
| Automatischer Müllimport | Im Code, produktiver Probelauf dokumentiert | RegioIT-Schnittstelle, Straßenkennung 284318, vier Fraktionen; geschützter Probelauf lieferte 78 Termine und HTTP 200. |
| Müllanzeige auf Startseite | Im Code, Browser geprüft | Nächster Abfuhrtermin und weitere Termine. Nächste Abholung umfasst insbesondere den Vortag und Abfuhrtag. |
| Müll-Push 15 Uhr am Vortag | Servercode und Cron eingerichtet; Zustellung nicht abgenommen | Berliner Zeitprüfung und Zustellvermeidung für doppelte Nachrichten vorhanden. Ein aktiver Job und HTTP-Erreichbarkeit beweisen keine Zustellung an zwei Geräte. |
| Eigenes gemeinsames Monatsbudget | Im Code und geprüft | Ein gemeinsamer Betrag; keine getrennten persönlichen Budgettöpfe. |
| Fixkosten und Ausgabenabzug | Im Code | Monatliche Fixkosten und bestätigte Ausgaben werden berücksichtigt. Fixkostenpflege aktuell hinzufügen/entfernen; kein umfassender Vertrags-/Abrechnungsplaner. |
| Positive/negative Monatsüberträge | Im Code und automatisiert geprüft | Vorherige Salden werden fortgeführt, Cent-Rundung vorhanden. |
| Vergangene Monate unverändert | Clientseitig umgesetzt und getestet | Monats-Schnappschüsse mit Beträgen, Ausgaben- und Fixkostenkopien. Noch keine eigenständige serverseitige Buchhaltung mit unveränderlichen Buchungsjournalen. |
| Monatsauswahl | Im Code | Historische Monate ansehen; abgeschlossene Monate nicht einfach neu buchen. |
| Bon fotografieren | Kamera-Dateieingabe vorhanden | Tatsächliche iPhone-Kamera-/Dateiformate noch nicht vollständig praktisch abgenommen. |
| Bon-OCR und Kontrolle | Im Code, Erkennungsqualität offen | TextDetector oder Tesseract, heuristische Extraktion von Geschäft/Datum/Betrag/Zeilen; Formular zur Korrektur vor Bestätigung. |
| Einkauf als ein Gesamtbetrag | Im Code | Eine Ausgabe je Einkauf; Artikel am Belegdatensatz gespeichert. |
| Bonbild vor Ausgabenspeicherung sichern | Im Code korrigiert | Bei Onlinebetrieb wird der Upload vor dem endgültigen Speichern geprüft. Ein Uploadfehler lässt den Kontrollschritt offen. Keine vollständige transaktionale Server-Verknüpfung aller Beleg- und Finanzoperationen. |
| Sparanalyse | Im Code | Sechs Monatswerte, größte Geschäfte, einfache regelbasierte Hinweise, Sparziel. Der Geschäftsgesamtvergleich nutzt derzeit alle vorhandenen Ausgaben und ist kein detailliert filterbarer Analysebereich. |
| Vier Dokumentordner | Im Code | Gemeinsam / Noah / Charleen / Lou. |
| Kategorien | Im Code | Anlegen und Umbenennen, auch Aktualisierung vorhandener Dokumentmetadaten. Die Kategorienliste ist derzeit haushaltsweit gemeinsam, nicht je Ordner separat modelliert. |
| Kategorie- und Gesamtsuche | Im Code; OCR-Suche DOM-geprüft | Alle Dokumente oder aktueller Ordner plus Kategorie; Suche über Name, Metadaten und OCR-Text. |
| Geschützte Dokumentdateien | Im Code und Datenbankgrundlage vorhanden | Supabase Storage, Haushaltsprüfung, zeitlich begrenzte signierte Links. Nicht alle historischen Pfad-/Berechtigungsfälle mit zwei Nutzern abgenommen. |
| PDF aus mehreren Bildern | Im Code | Mehrere Bilddateien werden per jsPDF zu einem PDF zusammengefasst; Name, Ordner, Kategorie und OCR-Text werden zugeordnet. |
| Originalfoto-Erhalt | Im Code | Beim Mehrbild-PDF werden Originalfotos zusätzlich gespeichert und in `original_paths` verzeichnet. Für sehr große Originale und alle Uploadfehler noch keine umfassende Geräteabnahme. |
| Vollwertiger iPhone-Scanner | Teilweise | Datei-/Kameraauswahl, Mehrbild-PDF, OCR, einfache Ausrichtung/Rand-/Kontrastbearbeitung vorhanden. Eine vollständige Seite-für-Seite-Kameraoberfläche mit sicherer Kanten-/Perspektivkorrektur fehlt. |
| OCR in vorhandenen beliebigen PDFs | Nicht vollständig umgesetzt | Die OCR-Pipeline richtet sich an Bilddateien und neu erzeugte Scans. Ein vollständiger Parser/OCR-Lauf für bereits hochgeladene beliebige PDFs ist nicht vorhanden. |
| Noahs persönliche Auftragsübersicht | Im Code, Browser geprüft | Offene Aufträge, neue Vorbereitung, Vorlagen-/Ausrüstungseinstieg, abgeschlossene Aufträge. |
| Montagevorlagen bearbeiten | Im Code, DOM und Browser geprüft | Klarer Button, Maschinen-/Materialauswahl, eigene Mengen, Arbeitsschritte und Hinweise. |
| Montageauftrag aus Vorlage | Im Code und geprüft | Eigene Kopie, Name, Datum, Status. Bestehende Aufträge ändern sich nicht bei späterer Vorlagenbearbeitung. |
| Material je Auftrag | Im Code und geprüft | Freie Ergänzung, Katalogvorschläge, eigene Mengen, Entfernen; Katalog/Template werden nicht still verändert. |
| Maschinen je Auftrag | Im Code | Auswahl aus Bestand; Wagen-/Extra-Kennzeichnung wird übernommen. |
| Arbeitsschritte | Im Code und geprüft | Hinzufügen, abhaken und entfernen; Status in Auftrag gespeichert. |
| Helfer-Packliste und Haken | Im Code und geprüft | Extra-Maschinen, Auftragsmaterial und Nachfüllbedarf; Packhaken im Auftrag gespeichert. |
| Vollständige Ausrüstung | Im Code | Aufklappbare Liste der zum Auftrag gehörenden Maschinen; keine eigenständige Vollinventur des gesamten Betriebs. |
| PDF-Packliste | Im Code und praktisch geprüft | Beispielauftrag im Browser als PDF heruntergeladen; Material, Arbeitsschritt und Maschine im tatsächlichen PDF-Text nachgewiesen. Mehrseitige Ausgabe ist im Generator vorgesehen. |
| Auftrag als neue Vorlage | Im Code | Explizite Aktion; auftragsspezifische Materialien werden hierfür bei Bedarf in den Katalog übernommen. |
| Aufträge vorbereitet/abgeschlossen | Im Code | Statusaktionen sowie Wiederöffnen und Übersicht abgeschlossener Aufträge. |
| Charleens eigene Oberfläche | Im Code, mobil geprüft | Eigene Seite, Aufgabe/Notiz, Datum, Kategorien, Erledigt-Status, Entfernen und Verknüpfungen. |
| Charleens frei erweiterbare Funktionen | Teilweise / fachlich offen | Kategorien frei pflegbar; beliebige neue Module ohne Code sind noch nicht möglich. Weitere konkrete fachliche Struktur soll mit ihr besprochen werden. |
| E-Mail-/Passwort-Anmeldung | Im Code und bestehende Sitzung praktisch beobachtet | Supabase Auth, eigenes App-Konto, gemeinsamer Haushalt. Nicht beide Konten neu im Abnahmetest eingerichtet. |
| Ohne ChatGPT anmelden | Hostingseitig umgesetzt und geprüft | Sites-Zugang auf public umgestellt; App-HTML und Skripte ohne zusätzliche ChatGPT-Sperre erreichbar. Haushaltsdaten separat durch Supabase geschützt. |
| Permanente Daten und Sync | Im Code; Teiltests bestanden | Kalender normalisiert; viele andere Bereiche im gemeinsamen JSON-Zustand. Revisionen, Merge und Cache vorhanden. Kein vollständig bestandener Zwei-Geräte-Langzeittest. |
| PWA / Installation / Push | Grundlagen im Code | Manifest, Icons, Service Worker, Benachrichtigungs- und Installationshinweise vorhanden. Betrieb auf echten iPhones einschließlich geschlossener PWA noch nicht abgenommen. |
| Steuer-/ELSTER-Bereich | Teilweise Altbestand | Steuer-Checklisten, Ausgabenkennzeichnung und Kontroll-JSON vorhanden. Keine echte ELSTER-Übertragung. |
| Arbeitstage und Versicherungen | Unvollständiger Altbestand | Formulare existieren. Der zentrale Submit-Handler verarbeitet derzeit nur task, shopping, expense und income; day und insurance werden dort nicht dauerhaft gespeichert. Diese Dialoge dürfen nicht als fertige Erfassungsfunktionen gelten. |
| Verträge und Einstellungen | Überwiegend Hinweise / geplant | Mehrere alte Details-Dialoge beschreiben spätere Funktionen. Kein vollständiges Vertrags- oder Einstellungsmodul. |

## Konkrete bekannte Grenzen für die Weiterentwicklung

1. **Dokumentenrechte aus älteren Versionen:** Neue Dokumente werden gemeinsam gespeichert. Die spätere Metadatenmigration setzt Sichtbarkeit auf shared. Alte Storage-Regeln enthalten weiterhin private Pfade mit Eigentümerprüfung. Ein historisches Dokument kann deshalb als gemeinsam gelistet sein, während der ursprüngliche Dateipfad für die andere Person gesperrt bleibt. Das muss mit vorhandenen Daten geprüft werden; es wurde bei der Übergabe nicht still umgestellt.
2. **Aufgabenarchitektur:** Der frühere Änderungsauftrag in der Projektdokumentation ist nicht vollständig erfüllt. Normalisierte Tabellen existieren, der Frontend-Umstieg und der Aufgaben-Serverjob fehlen. Die aktuell funktionierende Browserlogik darf beim Umbau nicht mit bereits aktiver Servermaterialisierung verwechselt werden.
3. **Charleens Formulare:** Die bestehende Aufgabe/Notiz lässt sich abhaken und entfernen; ein vollständiger Editor zum nachträglichen Ändern jedes vorhandenen Eintrags ist nicht vorhanden.
4. **Passwort-Wiederherstellung:** Die Texte erwähnen Wiederherstellung, aber die aktuelle Oberfläche enthält keinen vollständig ausgeführten „Passwort vergessen“-Ablauf.
5. **Haushaltsgröße:** Fachlich ist die App für Noah und Charleen gedacht. Die aktuelle join_household-Funktion enthält kein ausdrücklich hartes Zwei-Personen-Limit. Die Berechtigung beruht auf Haushaltsmitgliedschaft und Einladungscode.
6. **Buchhaltung:** Historische Budgetstände sind clientseitige Schnappschüsse im Haushaltszustand; ein vollständiges serverseitig unveränderliches Finanzjournal ist nicht vorhanden.
7. **Konfiguration:** Adresse, Wetterkoordinaten, Fußball-Fallback und manche Namen sind im Quellcode vorbelegt. Das angelegte settings-Objekt ist kein vollständiges sichtbares Konfigurationszentrum.
8. **Abhängigkeiten:** OCR und PDF-Erzeugung laden Bibliotheken/Modelle bei Bedarf von externen Quellen. Die gesamte App ist daher nicht allein durch Vorhandensein eines Service Workers vollständig offlinefähig.
9. **Mehrere Datenschreibvorgänge:** Bon-/Original-/PDF-/Metadaten-/Finanzspeicherung ist nicht durchgängig eine einzige Datenbanktransaktion. Fehlerbehandlung ist vorhanden, aber weitere Ausfall- und Retry-Tests sind sinnvoll.
10. **UI-Neugestaltung:** Der Nutzer hat die neue Struktur zum Ausprobieren akzeptiert, nicht jede einzelne Bedienentscheidung abschließend freigegeben. Rückmeldungen nach echter Nutzung stehen noch aus.

## Nachgewiesene Tests und Prüfgrenzen

Vorhandene automatisierte DOM-Prüfungen decken ab:

- Initialisierung und erneutes Rendern ohne Fehler an entfernten Elementen.
- Aufgaben abhaken und löschen.
- Drei-Wege-Abgleich einschließlich Löschungen und unabhängiger Feldänderungen.
- Einkaufssortierung und Entfernen.
- Laden der Dokumentliste und Suche im OCR-Text.
- Negativen Budgetübertrag und unveränderte historische Salden.
- Wiederholungen ohne doppelte IDs und Monatsende nach Februar.
- Kein Wiederanlegen absichtlich gelöschter Montage-Beispiele.
- Bereichswechsel Noah/Charleen.
- Auftrag aus Vorlage, zusätzliche Materialien und unabhängige Vorlagenmengen.
- Gespeicherte Packhaken nach erneutem Rendern.

Zusätzlich praktisch geprüft wurden:

- Lokale Finanzbedienung: 1.000 Euro Budget, 25 Euro Testausgabe, 975 Euro verbleibend.
- Lokaler Montageauftrag mit zusätzlichen Arbeitsschritten und Materialien.
- Tatsächlich heruntergeladenes Beispiel-PDF samt Textinhalten.
- Noahs Ansicht bei 390, 768 und 1440 Pixeln ohne horizontales Überlaufen; Charleens Mobilansicht bei 390 Pixeln.
- Vorlagenbearbeitung ohne horizontal überlaufenden mobilen Dialog.
- Erfolgreiche Veröffentlichung und Auslieferung der neuen Webdateien.
- Anonyme Anfragen an 15 Supabase-Datenbereiche wurden mit HTTP 401 zurückgewiesen.
- Geschützter Abfall-Sync: HTTP 200, 78 Termine. Erinnerungs-/Sync-Endpunkte weisen unautorisierte Aufrufe zurück.

Nicht nachgewiesen sind vollständige Praxisabnahme auf zwei echten iPhones, alle Offline-/Parallelkonflikte, Zugriff eines angemeldeten fremden Haushalts, tatsächliche Push-Zustellung, umfassende Kamera-/OCR-Qualität und ein vollständig funktionierender Perspektivscanner.

## Was bei dieser Übergabe nicht behauptet wird

Der ZIP-Export ist vollständig hinsichtlich des vorhandenen Quellcodes. Der gesamte Masterprompt ist weiterhin **nicht vollständig umgesetzt und abgenommen**. Upload, Veröffentlichung, vorhandener Code, bestandene Teiltests und vollständige funktionale Abnahme sind unterschiedliche Zustände.
