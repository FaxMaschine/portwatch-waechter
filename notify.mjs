// Vergleicht das Ergebnis von score.mjs mit state.json und schickt bei Aenderung eine
// ntfy-Nachricht. Fuehrt KEINEN fremden Code aus; das Ergebnis kommt als Text (Env RESULT)
// und wird streng geprueft, bevor es benutzt wird.
//
// Env: RESULT (JSON von score.mjs, leer = Abruf fehlgeschlagen), NTFY_TOPIC (sonst nur
// Konsole), NTFY_SERVER (optional). Beendet sich immer mit Code 0, damit GitHub nicht alle
// 15 Minuten eine Fehler-Mail schickt; Stoerungen meldet es stattdessen EINMAL per ntfy.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEITE = "https://portwatch-vi.xyz/#race";
const STATE = new URL("./state.json", import.meta.url);
export const WARNEN_NACH = 8; // Fehlversuche am Stueck (8 x 15 min = 2 h)

export function pruefe(roh) {
  const r = JSON.parse(roh);
  const zahl = (v) => {
    const n = Number(v);
    if (v === null || v === "" || !Number.isFinite(n) || n < 0 || n > 100) throw new Error(`ungueltige Zahl: ${v}`);
    return Math.round(n * 10) / 10;
  };
  const wort = (v) => (v == null ? null : String(v).replace(/[\r\n]+/g, " ").slice(0, 60));
  return {
    leader: zahl(r.leader),
    leaderId: wort(r.leaderId),
    leaderName: wort(r.leaderName ?? r.leaderId) ?? "?",
    top3: zahl(r.top3),
    furthest: wort(r.furthest),
    updated: wort(r.updated),
  };
}

export function unterschiede(alt, neu) {
  if (!alt || alt.leader == null) return [];
  const z = [];
  if (neu.leader !== alt.leader) {
    const pfeil = neu.leader > alt.leader ? "⬆️" : "⬇️";
    z.push(`${pfeil} Ladebalken ${alt.leader} % → ${neu.leader} %`);
  }
  if (neu.leaderId !== alt.leaderId) z.push(`👑 Neuer Erster: ${neu.leaderName} (vorher ${alt.leaderName})`);
  if (neu.furthest !== alt.furthest) z.push(`🏁 Weiteste Stufe: ${alt.furthest} → ${neu.furthest}`);
  return z;
}

// Entscheidet, was bei einem Lauf passiert. Rein, ohne Netz und Dateien, damit testbar.
// Gibt { state, nachricht } zurueck; nachricht = null heisst: nichts schicken.
export function schritt(alt, roh) {
  let neu = null;
  let fehler = null;
  if (!roh) fehler = "PortWatch nicht erreichbar";
  else {
    try { neu = pruefe(roh); } catch (e) { fehler = `Daten unlesbar (${e.message})`; }
  }

  if (fehler) {
    const fehlversuche = (alt?.fehlversuche ?? 0) + 1;
    const state = { ...(alt ?? {}), fehlversuche };
    const nachricht = fehlversuche === WARNEN_NACH
      ? { title: "PortWatch-Wächter hat ein Problem ⚠️", message: `${fehler}, seit etwa 2 Stunden. Ich melde mich wieder, sobald es klappt.`, tags: ["warning"] }
      : null;
    return { state, nachricht, log: `${fehler} (Fehlversuch ${fehlversuche})` };
  }

  const state = { ...neu, fehlversuche: 0 };
  if (!alt || alt.leader == null) {
    return {
      state,
      nachricht: { title: "PortWatch-Wächter läuft 🏎️", message: `Start: ${neu.leader} % (${neu.leaderName}), Top-3-Schnitt ${neu.top3} %.\nDu hörst wieder von mir, wenn sich der Balken bewegt.`, tags: ["checkered_flag"] },
      log: "Start",
    };
  }
  const z = unterschiede(alt, neu);
  if ((alt.fehlversuche ?? 0) >= WARNEN_NACH) z.push("✅ Wächter läuft wieder");
  if (!z.length) return { state, nachricht: null, log: `Keine Änderung: ${neu.leader} % ${neu.leaderName}` };
  return {
    state,
    nachricht: { title: `PortWatch: ${neu.leader} %`, message: z.join("\n") + `\nErster: ${neu.leaderName} · Top-3-Schnitt ${neu.top3} %`, tags: ["video_game"] },
    log: z.join(" | "),
  };
}

async function sende({ title, message, tags }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.log("(kein NTFY_TOPIC, nur Ausgabe)\n" + title + "\n" + message);
    return;
  }
  const r = await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, title, message, tags, click: SEITE }),
    signal: AbortSignal.timeout(20_000),
  });
  console.log("ntfy:", r.status);
}

async function main() {
  const alt = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  const { state, nachricht, log } = schritt(alt, process.env.RESULT);
  console.log(log);
  if (nachricht) {
    try { await sende(nachricht); } catch (e) { console.log("ntfy fehlgeschlagen:", e.message); }
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
