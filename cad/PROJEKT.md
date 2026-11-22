# Shaper Zeichenprogramm (Origin CAD)

Browser-CAD für den Schreiner, angelehnt an Softtech SPIRIT, mit Export für die Shaper Origin.
Eigene App, liegt im Ordner `cad/` des Zuhause-Repositories, hat mit der Zuhause-App sonst nichts zu tun.
Live: https://noahfa.github.io/zuhause/cad/ (installierbar auf iPad/PC, läuft danach auch ohne Internet). Maße in mm.

## Dateien
- `index.html` – Oberfläche und Gestaltung
- `cad.js` – das ganze Programm
- `font.js` – Einstrich-Schrift (Hershey Sans 1-stroke, Hinweis zur Herkunft steht in der Datei)
- `vendor/clipper.js` – Clipper 6.4.2 (Boost-Lizenz): Versatz und Formen kombinieren
- `sw.js`, `manifest.webmanifest`, Symbole – App-Installation und Offline-Betrieb
- `tests/check.cjs` – Prüfung im echten Browser: `node cad/tests/check.cjs [Foto-Ordner]`

**Bei jeder Änderung** `?v=` in `index.html` und `sw.js` (CACHE und ASSETS) gemeinsam hochzählen.

## Stand: Etappe 1 fertig
- Oberfläche: Menü oben, Werkzeuge links, Eigenschaften + Ebenen rechts, Befehlszeile + Status unten
- Zeichnen: Linie (L), Polylinie (PL), Rechteck (R), Kreis (K), Bogen 3 Punkte (B), Polygon (PG), Langloch (LL)
- Ändern: Verschieben (V), Kopieren (KO), Drehen (D), Spiegeln (SP), Versatz (VS), Abrunden (AR), Fasen (FA), Stutzen (ST), Reihe kopieren (RK), Zerlegen (ZL), Löschen (E)
- Maße: Bemaßung (BM, waagrecht/senkrecht automatisch), ausgerichtet (BA), Abstand messen (MS)
- Eingabe: `x,y`, `@dx,dy`, `@länge<winkel`, Zahl = Länge in Mausrichtung, Rechnen (`720-2*19`)
- Objektfang F3 (End, Mitte, Zentrum, Quadrant, Schnittpunkt), Raster F7, Ortho F8, Rasterfang F9
- Rückgängig/Wiederholen, Rahmenauswahl (links→rechts: ganz drin, rechts→links: berührt)
- Speichern/Öffnen als .json, Autosave im Browser

## Stand: Etappe 2 fertig (22.11.2026)
- **Fräsen je Objekt** (rechts unter „Fräsen“): Frästyp (Außen, Innen, Auf Linie, Tasche, Hilfslinie), Tiefe, Fräser-Ø frei eintippbar; leer = „Fräser-Standard“ der Zeichnung.
  „Automatisch“: geschlossen = Außen, liegt in einer anderen Kontur = Innen, offen = Auf Linie, Ebene „Hilfslinien“ = Hilfslinie.
- **Fräsvorschau F6**: Flächen nach Frästyp eingefärbt, gestrichelt der Weg der Fräsermitte, rot wo Material stehen bleibt (Fräser kommt nicht in die Ecke / passt nicht ins Loch). Warnung dazu auch in den Eigenschaften.
- **Verbinden (VB)**: lose Linien, Bögen und offene Polylinien werden zu Konturen (Toleranz 0,05 mm), Bögen bleiben echte Bögen.
- **Formen kombinieren**: Vereinigen (VE), Abziehen (AB), Schnittmenge (SM). Ergebnis sind Polylinien; Rundungen werden dabei auf 0,01 mm genau in kurze Stücke zerlegt.
- **Bohrbild (BB)**: Lochreihe 32, Topfband Ø35, Dübelbild, Lochkreis – mit Bezugspunkt (Ecke) und relativer Eingabe. Löcher werden als Tasche mit Tiefe angelegt.
- **Text / Gravur (TX)**: Einstrich-Schrift, Umlaute/ß/Ø, als „Auf Linie“ 1 mm tief.
- **App**: installierbar, offline nutzbar; iPad: zwei Finger = Zoom/Verschieben, Punkt wird beim Loslassen gesetzt, Knöpfe „Enter“ und „Esc“ an der Befehlszeile.

## Datenmodell (JSON)
`{ents:[...], layers:[{n,c,v}], cur, nid, def:{tool,depth}}` – Objekte:
- `line {a:[x,y], b}` · `pline {pts:[[x,y]...], closed, rect?, bl?}` · `circle {c, r}`
- `arc {c, r, a0, a1}` (Bogenmaß, gegen Uhrzeigersinn) · `slot {a, b, r}` · `dim {a, b, p, m:'h'|'v'|'al'}`
- `text {p:[x,y], s:'…', h, a}` – p = unten links, h = Höhe der Großbuchstaben, a = Winkel (Bogenmaß)
- `pline.bl`: Wölbung je Segment (wie DXF-„bulge“ = tan(Winkel/4), positiv = gegen Uhrzeigersinn); fehlt = alles gerade
- Jedes Objekt: `id`, `t` (Typ), `ly` (Ebene). Y zeigt nach oben.
- Fräsen (alle freiwillig): `ct` = `outside|inside|online|pocket|guide` (fehlt = Automatik), `cd` = Tiefe, `tool` = Fräser-Ø (fehlen = `def`)

## Etappe 3 – Dateien (als Nächstes)
- SVG-Export für die Origin (USB-Stick oder ShaperHub-Upload)
- SVG/DXF-Import, eigene Vorlagen

## Ideen / offen
- Topfband mit Dübellöchern des Beschlags (Bohrbild je Hersteller)
- Abrunden direkt an Polylinien-Ecken ohne Zerlegen
- Nach Vereinigen/Abziehen Rundungen wieder als echte Bögen erkennen

## Shaper-SVG-Format (für Etappe 3)
- Namespace im `<svg>`: `xmlns:shaper="http://www.shapertools.com/namespaces/shaper"`
- Pro Pfad: `shaper:cutType="outside|inside|online|pocket|guide"`, `shaper:cutDepth="6mm"`,
  `shaper:toolDia="6mm"`, `shaper:cutOffset="0mm"`
- Farbcodierung zusätzlich: Außen = schwarz gefüllt, Innen = weiß gefüllt + schwarzer Rand,
  Auf Linie = nur Linie, Tasche = grau, Hilfslinie = blau
- Maßeinheit im SVG in mm angeben (width/height mit "mm", viewBox passend), Y-Achse umdrehen
