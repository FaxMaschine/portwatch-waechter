// Rechnet den PortWatch-Ladebalken genau wie die Seite: laedt deren scoring.js und
// tracker.json und ruft overall() auf. Laeuft in GitHub Actions in einem eigenen Job
// OHNE Secrets und ohne Schreibrechte, weil hier fremder Code ausgefuehrt wird.
// Ausgabe: eine JSON-Zeile auf stdout, in Actions zusaetzlich als Job-Output "result".
import { appendFileSync } from "node:fs";

const BASIS = "https://portwatch-vi.xyz";
const UA = { "User-Agent": "portwatch-watcher/1.0", "Cache-Control": "no-cache" };

async function text(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

const ts = Date.now();
const daten = JSON.parse(await text(`${BASIS}/data/tracker.json?ts=${ts}`));
const quelle = await text(`${BASIS}/assets/js/scoring.js?ts=${ts}`);
const scoring = await import("data:text/javascript," + encodeURIComponent(quelle));

const ov = scoring.overall(daten.efforts.filter((e) => !e.nuked));
const effort = ov.leader?.effort;
const ergebnis = {
  leader: ov.score,
  leaderId: effort?.id ?? null,
  leaderName: effort?.name ?? effort?.id ?? null,
  top3: ov.top3,
  furthest: ov.furthest,
  updated: daten.updated ?? null,
};

// JSON.stringify maskiert Zeilenumbrueche, die Ausgabe bleibt also sicher eine Zeile.
const zeile = JSON.stringify(ergebnis);
console.log(zeile);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `result=${zeile}\n`);
