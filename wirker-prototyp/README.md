# Auftrag-Materialeingabe (Prototyp)

Entwurf der Maske für die Wirker-App. Läuft ohne Server: `index.html` im Browser öffnen
(am besten am Handy). Daten liegen im `localStorage`, Demodaten lassen sich im
Administrator-Modus unten in der Auftragsliste zurücksetzen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Aufbau der drei Ansichten, Zahlentastatur, Dialoge |
| `style.css` | Gestaltung, Mobile-First, dunkles Werkstatt-Thema |
| `app.js` | Daten, Ansichten, Zahlentastatur, Statuswechsel, Planung |
| `zeichnungen.js` | Platzhalter-Zeichnungen (in der echten App die Auftragszeichnung) |

## Was die Maske tut

- **Administrator-Modus** (Schalter oben rechts) gibt die Materialeingabe frei.
- **Zeichnung** groß oben; antippen zum Verschieben, zwei Finger zum Zoomen,
  Doppeltipp setzt zurück, `Vollbild` blendet alles andere aus.
- **Werkstoff** über große Schaltflächen (`4301`, `16Mn`, …). Die Systemtastatur geht
  nur auf, wenn ein anderer Werkstoff frei eingetippt wird.
- **Dimension** über eine eigene Zahlentastatur mit Komma. Die Felder sind `readonly`
  und haben `inputmode="none"`, damit die große Handytastatur nie erscheint.
  `weiter` springt zum nächsten Maß. Umschaltbar auf Flach / Rund / Rohr.
- **Speichern & einplanen** sichert das Material und setzt den Auftrag dabei von
  *angelegt* auf *Planung*; danach springt die Maske zum nächsten offenen Auftrag.
- **Planen von überall**: Schaltfläche unten rechts in jeder Ansicht, zusätzlich in
  jeder Auftragskarte und in der Ansicht *Planen* mit Suche.

## Für die Übernahme in die Wirker-App

Die drei eigenständigen Bausteine sind:

1. Zahlentastatur — `#numpad` in `index.html`, `numpadAuf()` / `numpadZu()` in `app.js`
   und `.numpad*` in `style.css`.
2. Werkstoff-Schnellwahl — `WERKSTOFFE` und `zeichneWerkstoffe()`.
3. Statuswechsel beim Speichern — Klick-Behandlung von `#speichern`.
