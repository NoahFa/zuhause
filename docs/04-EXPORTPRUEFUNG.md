# Prüfung des Übergabepakets

Prüfdatum: 16. November 2026.

## Neuester Stand

- Das aktive Veröffentlichungs-Checkout war sauber, ohne ungesicherte Quellcodeänderungen.
- Neuester Commit: `29ec090dcad61af87a4b0a3a81d35e57ef3f1c86`, erstellt am 15. November 2026.
- Die Sites-Versionsliste führt diesen Commit als neueste Version 8.
- Der zugehörige Deploymentstatus wurde erneut als `succeeded` bestätigt.
- Die Hosting-Zugangseinstellung ist weiterhin `public`, also ohne vorgeschaltete ChatGPT-Anmeldung.

## Quellcodevollständigkeit

- Der komplette versionierte Projektstand wurde mit `git archive` exportiert.
- Das unveränderte Originalarchiv enthält alle **39 versionierten Dateien** des Commits, einschließlich versteckter Projektdateien wie `.openai/hosting.json` und `.gitignore`.
- Diese Dateien wurden zusätzlich nach `Projekt/` entpackt.
- Ein späterer lokal vorhandener Nur-Lese-Test für anonyme Datenbankzugriffe wurde als zusätzliche Datei `Projekt/tests/verify-anonymous-access.cjs` beigefügt. Er war kein Bestandteil der veröffentlichten 39 Dateien und verändert die Anwendung nicht.
- Die Web-App besteht aus **17 Dateien** unter `Projekt/dist`, einschließlich des Unterordners `vendor`.
- `workspaces.js` und `workspaces.css` sind enthalten. Das sind die neuen persönlichen Bereiche und der aktuelle Montageablauf.
- Dokumentation, Masterprompt und zwei lokale Mobilvorschauen wurden zusätzlich beigefügt.

## Vergleich mit der Live-Auslieferung

Alle 17 Webdateien wurden per HTTP vom aktuellen Live-Link abgerufen. Alle lieferten HTTP 200.

- **16 Dateien** stimmen inhaltlich mit dem Export überein. Bei Textdateien wurden Windows-/Unix-Zeilenenden für diesen Vergleich vereinheitlicht; dies ist keine Änderung des Programminhalts. Die ZIP-Quelle bleibt die originale Git-Fassung.
- **index.html** enthält live zusätzlich ein automatisch vom Cloudflare-/Hosting-System eingefügtes Sicherheits-/Challenge-Skript. Der Vergleich ergab keine entfernten oder veränderten Quellcodezeichen des normalisierten Original-HTML, sondern ausschließlich diesen eingefügten Hostingblock.
- Der automatisch bei der Auslieferung erzeugte Cloudflare-Block ist kein Projektquellcode und wird absichtlich nicht in eine andere Hostingumgebung mitkopiert. Das originale vollständige `index.html` des aktuellen Commits ist enthalten.

Die zusätzliche Hosting-Einfügung und unterschiedliche Zeilenenden erklären, warum ein einfacher Bytevergleich der Live-HTML-Datei nicht denselben Hash wie das Quellarchiv ergibt. Das ist kein Rückgriff auf einen älteren App-Stand.

## Integrität der Ausgabedateien

`DATEIEN-SHA256.csv` enthält Dateiname, Größe und SHA-256 für den Inhalt des Übergabeordners, ausgenommen die Prüfliste selbst. Für die beiden fertigen ZIP-Ausgaben wird zusätzlich eine äußere `ZIP-PRUEFSUMMEN.txt` erzeugt.

Die ZIP-Inhaltslisten werden auf die verlangten Hauptdateien sowie Backend, Dokumentation, Masterprompt und neue workspaces-Dateien kontrolliert. Die vollständigen Laufzeit-Abhängigkeiten im bereits vendorten Supabase-Bundle und die vorhandenen Lockdateien sind enthalten; herunterladbare Testinstallationen und externe OCR-/PDF-CDN-Inhalte werden nicht mit einem Quellcode-Export verwechselt.

## Was diese Prüfung nicht leistet

Sie ist kein erneuter Volltest auf zwei echten iPhones, keine Datenbank-/Storage-Sicherung und keine vollständige Sicherheitszertifizierung. Vorhandene Code- und Gerätetestgrenzen sind in `02-UMSETZUNGSSTAND.md` ausdrücklich dokumentiert. Bei dieser Übergabe wurde die produktive App nicht geändert.
