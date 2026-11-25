# PortWatch-Wächter

Schickt eine Push-Nachricht aufs Handy (ntfy), sobald sich der Ladebalken auf
[portwatch-vi.xyz](https://portwatch-vi.xyz/#race) bewegt: Prozentzahl rauf oder runter,
neuer Erster oder neue weiteste Stufe. Läuft auf GitHub Actions alle 15 Minuten, also auch,
wenn der PC aus ist.

## So funktioniert es

| Datei | Aufgabe |
|---|---|
| `score.mjs` | lädt `tracker.json` und PortWatchs eigenes `scoring.js` und rechnet die Zahl genau wie die Seite |
| `notify.mjs` | vergleicht mit `state.json`, schickt bei Änderung die ntfy-Nachricht, speichert den neuen Stand |
| `test.mjs` | Tests ohne Netz: `node test.mjs` |
| `.github/workflows/watch.yml` | Zeitplan, zwei getrennte Jobs |

`score.mjs` führt fremden Code aus (PortWatchs `scoring.js`). Deshalb läuft es in einem
eigenen Job **ohne Secrets und ohne Schreibrechte**. Der zweite Job sieht nur das Ergebnis als
Text, prüft es (Zahl zwischen 0 und 100, kurze Namen ohne Zeilenumbrüche) und hat als einziger
das ntfy-Thema.

## Einrichtung

1. Secret `NTFY_TOPIC` im Repo anlegen (Settings → Secrets and variables → Actions).
2. In der ntfy-App dasselbe Thema abonnieren.
3. Actions → PortWatch-Waechter → *Run workflow*. Der erste Lauf schickt „Wächter läuft“.

## Abschalten

Actions → PortWatch-Waechter → `…` → *Disable workflow*, oder das Repo löschen.
