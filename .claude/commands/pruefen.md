---
description: Startet die vier Prüf-Agenten (Sicherheit, Oberfläche, Fehler, Bedienbarkeit) und fasst ihre Berichte für Noah zusammen.
---

Starte die vier Prüf-Agenten aus `.claude/agents/` **gleichzeitig** (je ein Agent pro Aufgabe):
`pruefer-sicherheit`, `pruefer-oberflaeche`, `pruefer-fehler`, `pruefer-bedienbarkeit`.
Falls nur bestimmte Bereiche genannt wurden ($ARGUMENTS), starte nur diese.

Die Agenten ändern nichts. Wenn alle fertig sind:
1. Fasse die Ergebnisse auf **Deutsch**, kurz und ohne Fachchinesisch für Noah zusammen – Gesamturteil zuerst, dann die wichtigsten Funde aller Agenten zusammen sortiert nach Dringlichkeit (doppelte Funde zusammenführen).
2. Trage offene Punkte unter „Geplant“ in `docs/05-PLANUNG.md` ein (mit Datum der Prüfung).
3. Frage Noah, welche Punkte umgesetzt werden sollen. Ändere ohne seine Zustimmung nichts an der App.
