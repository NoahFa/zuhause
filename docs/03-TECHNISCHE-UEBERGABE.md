# Technische Übergabe für das nächste Werkzeug

Stand: 16. November 2026. Keine Codeänderung, Migration oder neue Veröffentlichung im Rahmen dieses Exports.

## 1. Eindeutiger aktueller Stand

| Eigenschaft | Wert |
|---|---|
| Appname | Zuhause |
| App-/Asset-/Cache-Version | v10 |
| Git-Commit | `29ec090dcad61af87a4b0a3a81d35e57ef3f1c86` |
| Commitdatum | 15.11.2026, 18:32:10 Uhr mit Offset +01:00 |
| Sites-Version | 8 |
| Live-Adresse | `https://steuerkompass-zwei.charleen-quester.chatgpt.site` |
| Sites-Projekt | `appgprj_6af01a37ae2c8191b0cf9390e0cc2623` |
| Gespeicherte Version | `appgprj_6af01a37ae2c8191b0cf9390e0cc2623~appgver_c059d5245c6081919334e167bc4404d4` |
| Deployment | `appgdep_6af9ecb0b0488191b695e70aba620b2e` |
| Zuletzt bestätigter Deploymentstatus | `succeeded`, bei der Übergabe erneut geprüft |
| Sites-Zugang | public: keine vorgeschaltete ChatGPT-Anmeldung |
| Eigene App-Anmeldung | Supabase Auth, E-Mail und Passwort |
| Supabase-Projektadresse | `https://mvdnatelwrakkkvdwcaa.supabase.co` |
| Fachliche Zeitzone | Europe/Berlin |

Die Sites-Versionsnummer 8 darf nicht mit einem alten Stand vom 8. November verwechselt werden. Die ältere erfolgreiche Version 7 gehörte zur vorherigen App-Fassung v9. Die neuen persönlichen Bereiche sind App-Fassung v10 / Sites-Version 8.

Eine frühere Cloudflare-Pages-Adresse `https://zuhause-familienapp.pages.dev` wird in historischen Berichten erwähnt. Sie ist ein separates Veröffentlichungsziel und wurde bei dieser Übergabe nicht als aktuelle Hauptveröffentlichung nachgewiesen. Nicht daraus den alten Code zurückholen.

## 2. Projektaufbau und sämtliche produktiven Webdateien

Die Anwendung ist eine statische HTML-/CSS-/JavaScript-App. Es gibt kein React-/Next-/Vue-Projekt und keinen notwendigen Frontend-Buildschritt.

Die vollständige auslieferbare Web-App liegt unter **Projekt/dist**:

| Datei | Rolle |
|---|---|
| `index.html` | App-Grundgerüst, Anmeldung, gemeinsame Bereiche, bestehende Kalender-/Steuer-/Dokumentdialoge, Einbindung der Skripte und Styles |
| `app.js` | Supabase-Client, Auth, Haushalt, gemeinsamer Zustand, Merge/Revisionen, grundlegende Erfassungsdialoge, Dokumentupload, Push-Abonnement und Grundrendering |
| `styles.css` | Bestehendes Design, gemeinsame Bereiche, Kalender, Auth, Dialoge, responsive Basis |
| `calendar.js` | Normalisierter Kalender, Ansichten, Filter, Termine, Wiederholungen, Offline-/Realtime-Bausteine |
| `features.js` | Erweiterte Aufgaben, Einkaufsparser, Wetter, Abfallanzeige, Budget, Sparanalyse, Bon-OCR, Dokumente/Scan und ursprünglich ergänzte persönliche Bereiche |
| `features.css` | Styles dieser Erweiterungen |
| `workspaces.js` | Neueste persönliche Bereichsnavigation, Noahs Auftragsübersicht, neuer Montageablauf, Auftragsschnappschüsse, Vorlagenmengen, Auftragsmaterial und -aufgaben, Packhaken und PDF |
| `workspaces.css` | Große persönliche Oberflächen, Bereichsumschaltung, Auftrags-/Vorlagen-/Ausrüstungsansichten, mobile Anpassungen |
| `sw.js` | Service Worker, Cache `zuhause-v10`, statische Assets einschließlich workspaces-Dateien, Push-Empfang und Benachrichtigungsklick |
| `manifest.webmanifest` | PWA-Manifest, Start `./?app=10`, deutsche Sprache, Standalone-Anzeige, Farben und Icons |
| `icon.svg` | Vektor-Hausicon mit zwei Haushaltsmitgliedern |
| `icon-192.png` | PWA-Icon 192 Pixel |
| `icon-512.png` | PWA-Icon 512 Pixel |
| `icon-maskable-512.png` | Maskierbares PWA-Icon |
| `apple-touch-icon.png` | iPhone-Home-Bildschirm-Icon |
| `_headers` | Hostingabhängige Sicherheitsheader und Cache-Regeln |
| `vendor/supabase.min.js` | Lokal enthaltenes Supabase-Browserbundle, Version 2.49.4 |

Alle diese Dateien gehören zusammen. Nur `index.html`, `app.js` und `styles.css` zu übernehmen würde wesentliche aktuelle Funktionen verlieren.

### Einbindungsreihenfolge

Styles:

1. `styles.css?v=10`.
2. `features.css?v=10`.
3. `workspaces.css?v=10`.

Skripte:

1. `vendor/supabase.min.js?v=2.49.4`.
2. `calendar.js?v=10`.
3. `app.js?v=10`.
4. `features.js?v=10`.
5. `workspaces.js?v=10`.

Die Dateien sind derzeit klassische Skripte mit gemeinsamem globalem Zustand, nicht unabhängig importierbare ES-Module. `features.js` ergänzt bzw. überschreibt bestimmte Renderfunktionen aus `app.js`. `workspaces.js` baut darauf auf und ersetzt die Montageoberfläche; `features.js` überspringt seine alte Montageausgabe, sobald die Seite als neu gestaltet markiert ist. Bei einer zukünftigen Modularisierung diese Abhängigkeit bewusst auflösen.

## 3. Weitere Projektdateien

### Backend

- `supabase/schema.sql`: gewachsene Datenbankdefinitionen und Migrationen, Tabellen, Funktionen, Indizes, Berechtigungen, Storage- und Kalender-/Aufgaben-Erweiterungen.
- `supabase/cron.sql`: fünf geplante Hintergrundaufrufe.
- `supabase/config.toml`: Edge-Function-Konfiguration.
- `supabase/functions/_shared/cron-auth.ts`: gemeinsamer Schutz für Cron-Aufrufe.
- `supabase/functions/sync-family-content/index.ts`: Synchronisation Abfall, Fußball, gute Nachrichten.
- `supabase/functions/send-waste-reminders/index.ts`: Müll-Push am Vortag im Berliner 15-Uhr-Fenster.
- `supabase/functions/send-event-reminders/index.ts`: persönliche Kalender-Erinnerungen.

### Hosting und Abhängigkeiten

- `.openai/hosting.json`: Zuordnung zum bestehenden Sites-Projekt, statisches Verzeichnis `dist`.
- `.gitignore`: schließt unter anderem installierte Testabhängigkeiten und QA-Bilder aus der Versionierung aus.
- `VENDOR-NOTICE.md`: Herkunft und Prüfsumme des Supabase-Browserbundles.
- `tools/generate-icons.ps1`: Icon-Erzeugung.
- `tools/dom-test/package.json`: Testabhängigkeit jsdom 26.1.0.
- `tools/dom-test/pnpm-lock.yaml`: gesperrte Testabhängigkeiten.

### Tests

- Entfernt am 20.11.2026 (veraltet, liefen nicht mehr): `features-static.cjs`, `calendar-ui.cjs`, `verify-live.cjs`. Aktuelle Prüfungen: `regression.cjs`, `ui-check.cjs`, `scanner-check.cjs`, `recipes-check.cjs`, `verify-anonymous-access.cjs`.
- `tests/regression.cjs`: DOM-basierte Ablaufprüfungen einschließlich neuer persönlicher Bereiche und Montage.
- `tests/static-server.cjs`: lokaler statischer Entwicklungsserver.
- `tests/verify-anonymous-access.cjs`: ergänzter späterer Nur-Lese-Test für 15 Supabase-Datenbereiche ohne App-Anmeldung. Diese Datei liegt zusätzlich zum exakten Git-Archiv in der Übergabe.

### Historische Berichte im unveränderten Projekt

- `TECHNISCHE-UEBERARBEITUNG-2026-11-09.md`.
- `BESTANDSAUFNAHME-MASTER-PROMPT-2026-11-10.md`.
- `SITE-AENDERUNGSAUFTRAG-01-AUFGABENMODELL.md`.
- `PRUEFBERICHT-2026-11-15.md`.

Diese Dokumente nicht löschen, aber nicht ungeprüft als aktuellen Ist-Stand lesen. Die heutige fachliche Übergabe erklärt Widersprüche und Weiterentwicklungen.

## 4. Datenhaltung

### Gemeinsamer JSON-Zustand

Viele fachliche Bereiche werden weiterhin als gemeinsamer Datensatz in `public.app_state.data` gespeichert. Der aktuelle Zustand enthält insbesondere:

- `appointments`: älterer Kalenderbestand; separat behandelt, um den normalisierten Kalender nicht zu überschreiben.
- `householdTasks`: aktuelle Haushaltsaufgaben und deren Wiederholungsinstanzen.
- `shopping`: gemeinsame Einkaufsartikel.
- `expenses`: Ausgaben, teilweise mit Belegartikeln und OCR-Text.
- `incomes`: Einnahmen für die vorhandene Nebengewerbeansicht.
- `taxTasks`: Steuer-Checkliste.
- `documentChecklist`: Dokumenten-Checkliste.
- `fixedCosts`: Fixkosten.
- `receiptDrafts`: vorgesehenes Zustandsfeld; nicht als vollständig ausgeführter separater Entwurfsmanager missverstehen.
- `montageMachines`: Maschinen-/Werkzeugkatalog.
- `montageMaterials`: Verbrauchsmaterialkatalog.
- `montageTemplates`: Montagevorlagen.
- `montageJobs`: neue konkrete Montageaufträge.
- `studyItems`: Charleens Aufgaben und Notizen.
- `customCategories`: unter anderem Dokument-/Studienkategorien und vorbereitete Einkaufszuordnungen.
- `budget`: laufender Betrag, optionale Monatsbeträge, Startmonat, Sparziel und historische Monats-Schnappschüsse.
- `settings`: Konfigurationswerte, Montage-Initialisierung und zuletzt gewählter Montageauftrag.

Nicht jedes Feld steht vollständig im ursprünglichen seed-Objekt. `montageJobs` wird beispielsweise in `workspaces.js` initialisiert; `mergedState` übernimmt zusätzliche Felder des Cloud-Zustands. Beim Refactoring nicht durch ein zu enges Schema versehentlich verwerfen.

### Montage-Datensätze

Maschinenkatalog:

- Kennung, Name, Kategorie.
- `placement`: `van` oder `extra`.
- `refill`: fehlt/nachfüllen.

Materialkatalog:

- Kennung, Name, Kategorie.
- Menge als freie Zeichenfolge, zum Beispiel „2 Dosen“.
- Nachfüllmarkierung.

Vorlagen:

- Kennung, Name, Hinweise.
- `machineIds`, `materialIds`.
- `materialQuantities`: eigene Standardmenge je Materialkennung.
- `tasks`: übliche Arbeitsschritte als Textliste.

Aufträge:

- Kennung, Titel, Montagedatum.
- Vorlagenkennung/-name, falls aus Vorlage erzeugt.
- Eigene kopierte Maschinen- und Materialdaten.
- Auftragsbezogene Materialmenge; optional `catalogId` bei zusätzlichem Material.
- Arbeitsschritte mit Kennung, Titel und erledigt-Status.
- Hinweise.
- Status `draft`, `ready` oder `done`.
- Gespeicherte Packhaken an kopierten Zeilen und gegebenenfalls `extraPackChecks` für zusätzlich eingeblendete Nachfüllposten.
- Erstellungs-/Änderungszeitpunkt.

Vorlagenänderungen verändern bestehende Auftragskopien nicht. Ausdrückliches „Als neue Vorlage speichern“ übernimmt Auftragsmaterial bei Bedarf in den Katalog. Das ist fachlich anders als das bloße Ergänzen im heutigen Auftrag.

### Normalisierte Tabellen

- Haushalt und Zugehörigkeit: `households`, `household_members`.
- Gemeinsamer Zustand: `app_state`.
- Dokumentmetadaten: `documents`, einschließlich `folder`, `ocr_text`, `original_paths`.
- Automatische Inhalte: `external_events`, `daily_content`, `sync_runs`.
- Geräte-Push: `push_subscriptions`, `notification_deliveries`.
- Kalender: `calendars`, `calendar_events`, `event_participants`, `event_recurrences`, `event_exceptions`, `event_reminders`, `event_notification_deliveries`.
- Vorbereitete Aufgabenstruktur: `task_series`, `task_instances`. Diese Tabellen werden aktuell noch nicht als primäre Aufgabenquelle im Frontend verwendet.

### Wichtige Datenbankfunktionen

- `is_household_member` prüft die Zugehörigkeit anhand der angemeldeten Supabase-Identität.
- `create_household` legt Haushalt, erstes Mitglied und Zustand an.
- `join_household` ordnet einen angemeldeten Nutzer über den Einladungscode zu.
- `save_app_state_without_calendar(next_data, expected_revision)` speichert den gemeinsamen Zustand mit Revision und bewahrt die separat behandelten Kalenderanteile.
- `create_default_calendars` richtet die drei Standardkalender ein.

Das vollständige SQL steht unverändert im Projekt. Dieses Dokument ersetzt weder einen Datenbank-Dump noch eine Prüfung, welche Migrationen im Zielsystem schon angewendet wurden.

## 5. Synchronisierung und Offline-Verhalten

1. `app_state` besitzt eine Revision.
2. Der Client sendet die erwartete Revision beim Speichern.
3. Konflikte führen zum Nachladen und Drei-Wege-Abgleich mit dem zuletzt bestätigten Ausgangsstand.
4. Arrayeinträge werden über Kennungen zusammengeführt; Löschungen und Änderungen einzelner Felder werden berücksichtigt.
5. Der lokale Cache ist nach Nutzer und Haushalt getrennt. Zustands-, dirty- und base-Werte werden gespeichert.
6. Speicherung wird verzögert gebündelt; weitere Änderungen während eines laufenden Speicherns werden nachgesendet.
7. Aktualisierung des gemeinsamen Zustands läuft grundsätzlich im 15-Sekunden-Takt und bei Fokus-/Verbindungsereignissen.
8. Dokumente und automatische Inhalte werden dabei ebenfalls nachgeladen, auch wenn sich der übrige Zustand nicht geändert hat.
9. Kalender verwenden zusätzlich ihren eigenen normalisierten Realtime-/Offline-Weg.
10. Haushaltswiederholungen werden clientseitig erzeugt; der Tageswechsel wird zusätzlich im Minutenrhythmus geprüft.
11. Nicht vollständig getestet: alle gleichzeitigen Änderungen, Offline-Konflikte und Langzeitfälle auf zwei echten Geräten.

## 6. Anmeldung, Registrierung und Backend-Wechsel

Die eigene App-Anmeldung erfolgt über Supabase. Eine vorhandene Sitzung kann den Haushalt automatisch öffnen. Die zusätzliche Sites-/ChatGPT-Anmeldung wurde entfernt.

Bei einem neuen Hosting:

1. Alle Dateien aus `dist` gemeinsam ausliefern.
2. HTTPS verwenden.
3. Die Auth-Konfiguration des vorhandenen Supabase-Projekts für die neue Domain prüfen, insbesondere Site-URL und erlaubte Redirect-URLs für Bestätigungslinks.
4. In `app.js` wird bei Registrierung `emailRedirectTo: location.origin` verwendet.
5. Öffentliche Projektadresse und Browser-Schlüssel nur dann ändern, wenn tatsächlich ein anderes Supabase-Projekt benutzt werden soll.
6. Bestehende Konten, Haushalte und Daten nicht durch ein neues leeres Projekt ersetzen, ohne eine ausdrückliche Datenmigration vorzubereiten.
7. Registrierung und Haushaltseinladung sind vorhandene Verfahren; ein vollständiger Passwort-zurücksetzen-Dialog fehlt noch.
8. Die Zuordnung `person1`/`person2` orientiert sich aktuell an Eigentümer-/weiterem Mitglied. Diese internen Schlüssel nicht ohne Datenmigration in Namen umbenennen.

Der öffentlich erreichbare Seitenaufruf ist beabsichtigt. Die eigentliche Autorisierung muss weiterhin serverseitig durch Supabase Auth, Haushaltszugehörigkeit und RLS erfolgen. Die aktuelle anonyme Prüfung ist kein Ersatz für eine vollständige Prüfung mit einem angemeldeten fremden Haushalt.

## 7. Dokumente und Speicher

- Supabase-Storage-Bucket: `receipts`.
- Erwartet: nicht öffentlich.
- Neue Dateien werden unter dem Haushalt und `shared` abgelegt.
- Mehrbild-Scans legen zusätzlich Originalfotos in einem Unterpfad `originals` ab; Metadaten verweisen über `original_paths` darauf.
- Unterstützte MIME-Typen im aktuellen Upload: PDF, JPEG, PNG und WebP.
- Dateigrößenlimit im Frontend und vorgesehenen Bucket: 10 MiB je Datei.
- HEIC ist nicht als eigener Upload-MIME-Typ freigegeben; nicht pauschal alle iPhone-Dateiformate als unterstützt angeben.
- Öffnen erfolgt über signierte URLs mit kurzer Gültigkeit, aktuell 60 Sekunden.
- Upload- und Metadatenfehler werden teilweise durch Rücknahme bereits hochgeladener Dateien behandelt.
- Aufbewahrung der Originale ist implementiert, aber keine vollständige Versionierungs-/Backupstrategie.

Historische private Storage-Pfade und die später gemeinsam gesetzten Dokumentmetadaten müssen bei der weiteren Rechteprüfung zusammen betrachtet werden. Nicht die neue Metadatenregel allein als Garantie für jeden Altbestand betrachten.

## 8. Externe Abhängigkeiten und Quellen

| Zweck | Aktuelle Abhängigkeit / Quelle |
|---|---|
| Browser-Supabase-Client | Lokal vendortes `@supabase/supabase-js` 2.49.4 |
| Backend-Supabase-Client | Deno-Import von `https://esm.sh/@supabase/supabase-js@2` |
| PDF | jsPDF 2.5.2 über jsDelivr, bei Bedarf geladen |
| OCR | TextDetector, falls verfügbar; sonst Tesseract.js 5.1.1 über jsDelivr, Sprache `deu` |
| OCR-Modelle/Worker | Externe Modell-/Bibliotheksquellen; entsprechende Domains sind in der CSP zugelassen |
| Push-Versand | `npm:web-push@3.6.7` in den Edge Functions |
| DOM-Tests | jsdom 26.1.0, im eigenen Testunterordner |
| Wetter | Open-Meteo, feste Koordinaten 50.9856 / 7.13298, Europe/Berlin |
| Abfall | `https://aw-bgl2-abfallapp.regioit.de/abfall-app-aw-bgl2/rest/strassen/284318/termine` |
| Offizieller Abfallquellen-Link | `https://www.bergischgladbach.de/abfuhrbezirksabfrage.aspx` |
| Fußball | FUSSBALL.DE-Team-Spielplan, vorhandener SC-27-Fallback |
| Gute Nachrichten | `https://goodnews.eu/feed/` |
| Spracheingabe | SpeechRecognition / webkitSpeechRecognition, browserabhängig |

Die Originaldateien werden unverändert exportiert. Extern geladene Bibliotheken und OCR-Modelle werden nicht still zusätzlich vendort oder ihre URLs verändert. Die App ist deshalb nicht als vollständig selbstenthaltene Offline-App zu behandeln.

## 9. Secrets und Hintergrundjobs

Benötigte Serverkonfiguration, ohne Export der geheimen Werte:

- `SUPABASE_URL`.
- `SUPABASE_SERVICE_ROLE_KEY` bzw. die vom bestehenden Functions-Projekt bereitgestellte privilegierte Konfiguration.
- `CRON_SECRET`.
- `VAPID_PUBLIC_KEY`.
- `VAPID_PRIVATE_KEY`.
- Optional überschreibbar: `WASTE_STREET_ID`, `WASTE_SOURCE_URL`, `FOOTBALL_TEAM_ID`, `FOOTBALL_TEAM_NAME`.
- Supabase Vault: derselbe Cron-Schlüssel unter `zuhause_cron_secret`.

Der öffentliche VAPID-Schlüssel steht im Frontend. Privater VAPID-Schlüssel und Cron-Secret müssen weiterhin im Backend liegen. Bei einer Änderung des Push-Schlüsselpaares können neue Geräteabonnements nötig werden; nicht ohne Anlass rotieren.

In `supabase/config.toml` ist die Plattform-JWT-Prüfung der drei Hintergrundfunktionen deaktiviert. Das ist nur zusammen mit der implementierten eigenen Prüfung des `Authorization: Bearer <CRON_SECRET>` vorgesehen. Diese Prüfung beim Übertragen nicht entfernen.

Vorhandene Cron-Zeitpläne aus `cron.sql`:

| Jobname | Ausdruck | Zweck |
|---|---|---|
| zuhause-muell | `20 4 * * *` | täglicher Abfallimport |
| zuhause-fussball | `10 5,17 * * *` | Fußballimport zweimal täglich |
| zuhause-good-news | `30 5 * * *` | gute Nachricht |
| zuhause-erinnerungen | `*/15 * * * *` | Prüfung der Müll-Push-Erinnerungen |
| zuhause-termin-erinnerungen | `*/5 * * * *` | Kalender-Erinnerungen |

Diese Ausdrücke nicht pauschal als Berliner Uhrzeiten lesen; die tatsächliche Cron-/Datenbankzeitzone im Projekt prüfen. Die Müllfunktion führt ihre eigene Europe/Berlin-Prüfung durch und sendet nur im 15-Uhr-Fenster. Die Kalenderfunktion berechnet Berliner Wandzeiten. Ein eigener Cron für Haushalts-Aufgabenserien ist nicht vorhanden.

`cron.sql` enthält ein Unschedule vorhandener Jobs vor dem Neuplanen. Beim Weiterbetrieb nicht blind ausführen, wenn nur Frontend-Dateien geändert werden.

## 10. PWA und Sicherheitsheader

- `sw.js` nutzt den Cache `zuhause-v10`.
- Sowohl Hauptassets als auch `workspaces.js` und `workspaces.css` sind in der Cacheinstallation berücksichtigt.
- Nur erfolgreiche gleich-originige GET-Antworten werden zwischengespeichert; Supabase-Antworten werden nicht pauschal als App-Cache gespiegelt.
- Push-Daten werden als Benachrichtigung angezeigt; ein Klick öffnet bzw. fokussiert die App.
- Bei einer neuen Version Cachekennung, Query-Versionen und Manifestbezüge konsistent anpassen.
- `_headers` enthält CSP, Referrer-Policy, nosniff, Frame-Schutz, Kamera-/Mikrofonregeln und HSTS sowie Regeln für `sw.js` und `index.html`.
- CSP erlaubt die tatsächlich verwendeten Supabase-, Wetter-, Abfall-, CDN-/OCR-Quellen und WebAssembly-Ausführung für OCR.
- Nicht jeder Hoster interpretiert eine Datei namens `_headers`. Bei einem anderen Werkzeug müssen dieselben Header gegebenenfalls in dessen eigener Hostingkonfiguration gesetzt werden.
- Kamera, Mikrofon und Push sind von Browser-/Betriebssystemrechten abhängig.

## 11. Lokal starten und prüfen

Voraussetzung: Node.js. Die Web-App selbst benötigt keinen Node-Server für fachliche Backendaufgaben; Node wird hier nur als einfacher lokaler HTTP-Server und für Tests verwendet.

Im Ordner `Projekt`:

```text
node tests/static-server.cjs 4192
```

Normale App mit bestehendem Backend:

```text
http://127.0.0.1:4192/
```

Lokale Vorschau ohne App-Anmeldung und ohne produktives Speichern über den normalen Anmeldepfad:

```text
http://127.0.0.1:4192/?preview=calendar
```

Der Vorschaupfad ist im Code auf Hostnamen `localhost` und `127.0.0.1` begrenzt. Er zeigt zunächst den Kalender; danach können die Bereiche gewechselt werden. Normale produktive Anmeldung und echte Haushaltsdaten nicht mit lokalen Vorschau-Testdaten verwechseln.

Für die DOM-Tests die Testabhängigkeiten installieren, zum Beispiel mit pnpm:

```text
pnpm --dir tools/dom-test install --frozen-lockfile
node tests/regression.cjs
```

Syntaxprüfungen:

```text
node --check dist/app.js
node --check dist/calendar.js
node --check dist/features.js
node --check dist/workspaces.js
node --check dist/sw.js
```

Die TypScript-/Deno-Funktionen nicht mit einer einfachen JavaScript-Syntaxprüfung verwechseln. `node --check index.ts` war in der vorhandenen Umgebung kein gültiger Deno-TypeScript-Check.

## 12. Was auf Servern bereits geändert wurde

Aus dem bisherigen Arbeitsnachweis:

- Die aktuelle App wurde über Sites veröffentlicht; neueste Ausgabe App v10 / Sites 8.
- Die ChatGPT-Zugangssperre wurde entfernt; Sites-Zugang public.
- Produktive Dokumentfelder `folder`, `ocr_text`, `original_paths` wurden ergänzt.
- Dokumentmetadaten wurden auf gemeinsame Sichtbarkeit umgestellt.
- Die Tabellen für Aufgabenserien und Aufgabeninstanzen wurden angelegt; Frontend-Umstieg noch offen.
- Die produktive Inhalts-Sync-Funktion wurde von aneinandergehängten alten Codefassungen bereinigt und mit Cron-Schutz bereitgestellt.
- Die Müll-Push-Funktion wurde repariert und erneut bereitgestellt.
- Fünf Cron-Jobs und Vorhandensein des Vault-Cron-Geheimnisses wurden geprüft.
- Ein Abfall-Probelauf lieferte 78 Termine; unautorisierte Function-Aufrufe wurden zurückgewiesen.

Diese Liste ersetzt keinen vollständigen Supabase-Export. Die gesamte historische `schema.sql` wurde im letzten Schritt nicht pauschal als Vollskript neu angewendet. Vor einer Migration den tatsächlichen Bestand prüfen.

## 13. Übernahme in ein anderes Werkzeug

### Nur Frontend weiterentwickeln

1. Den vollständigen Ordner `Projekt/dist` übernehmen.
2. Die fünf Skripte und drei Styles in ihrer jetzigen Reihenfolge erhalten.
3. Das vorhandene Supabase-Projekt zunächst weiterverwenden.
4. Sicherheitsheader und Auth-Redirects für das neue Hosting prüfen.
5. Testen, ob bestehende Konten und derselbe Haushalt geöffnet werden.
6. Erst danach Datenmodelle oder UI-Struktur schrittweise ändern.

### Backend ebenfalls wechseln

1. Gesondertes Backup der Datenbank einschließlich Auth-/Haushaltszuordnung planen.
2. Gesonderten Export aller Storage-Dateien und ihrer Metadaten planen.
3. Kalender, JSON-Zustand und Montageaufträge vollständig übernehmen.
4. Rechte pro Haushalt, alte private Dokumentpfade und signierte URLs prüfen.
5. Edge Functions, Secrets, Vault, Cron-Jobs und Push-Abonnements berücksichtigen.
6. Testumgebung und echte Zwei-Nutzer-Abnahme durchführen.

Solche Daten-/Konten-/Hostingmigrationen wurden für diesen Export nicht ausgeführt.

## 14. Paketprüfung

Der unveränderte Original-Commit und die vollständigen Frontenddateien werden separat gesichert. Die Übergabe enthält ein dateiweises SHA-256-Verzeichnis. Damit kann das neue Werkzeug prüfen, ob eine Datei unverändert übernommen wurde.

Nicht enthalten: `.git`-Historie, `node_modules`, Laufzeit-Caches, Auth-Tokens, private Secrets, persönliche Cloud-Daten und Dokumentoriginale. Vorhanden sind sämtliche versionierten Projektdateien, Lockdateien, Backenddefinitionen, Funktionen, Tests, Icons und zusätzliche Übergabedokumente.
