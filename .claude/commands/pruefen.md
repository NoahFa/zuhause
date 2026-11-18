---
description: Startet die vier Prüf-Agenten (Sicherheit, Oberfläche, Fehler, Bedienbarkeit) und fasst ihre Berichte für Noah zusammen.
---

Starte die vier Prüf-Agenten aus `.claude/agents/` **gleichzeitig** (je ein Agent pro Aufgabe, im Hintergrund):
`pruefer-sicherheit`, `pruefer-oberflaeche`, `pruefer-fehler`, `pruefer-bedienbarkeit`.
Falls nur bestimmte Bereiche genannt wurden ($ARGUMENTS), starte nur diese.

Gib jedem Agenten mit:
- heutiges Datum und aktuelle Version (`CACHE` in `sw.js`)
- was seit der letzten Prüfung neu ist (aus `docs/05-PLANUNG.md`)
- einen eigenen Unterordner im Scratchpad für Fotos und Skripte (`pruefung-<bereich>`)

Während die Agenten laufen: dem Nutzer kurz sagen, dass sie laufen. Hält ein Agent wegen Kontingent an, später mit SendMessage fortsetzen.

Wenn alle fertig sind:
1. **Abfragen für die Hauptsitzung** aus den Berichten selbst ausführen (nur lesend, z. B. über die Supabase-Verwaltungs-API) und die Ergebnisse in die Bewertung übernehmen. Bestätigte Funde behalten, widerlegte streichen.
2. **Zusammenfassen** auf Deutsch, kurz, ohne Fachchinesisch für Noah:
   - Gesamturteil zuerst.
   - Doppelte Funde zusammenführen (Kurzlisten der Agenten nutzen).
   - In Blöcke ordnen:
     - **A** Fehler und Verlust (dringend)
     - **B/C** Bedienung und Darstellung je Bereich
     - **D** andere Bereiche
     - **E** Aufräumen und Sicherheit
   - Je Punkt ein Satz, was Noah oder Charleen davon merken.
   - Zum Schluss: was nicht prüfbar war.
3. **Eintragen:** offene Punkte unter „Geplant“ in `docs/05-PLANUNG.md` (mit Datum der Prüfung und Version), committen und auf den Branch pushen (nur Doku, keine App-Änderung).
4. **Fragen**, welche Blöcke umgesetzt werden sollen (Mehrfachauswahl). Ändere ohne Zustimmung nichts an der App.
