// Tests ohne Netz: node test.mjs
import assert from "node:assert/strict";
import { pruefe, unterschiede, schritt, WARNEN_NACH } from "./notify.mjs";

const basis = { leader: 77.4, leaderId: "belobug", leaderName: "Belobug", top3: 67.5, furthest: "playable", updated: "x" };
const roh = (o) => JSON.stringify({ ...basis, ...o });
const neu = pruefe(roh({}));

// --- pruefe ---
assert.equal(neu.leader, 77.4);
assert.throws(() => pruefe(roh({ leader: "abc" })));
assert.throws(() => pruefe(roh({ leader: 250 })));
assert.throws(() => pruefe(roh({ leader: null })), "null darf nicht als 0 durchgehen");
assert.throws(() => pruefe(roh({ leader: "" })), "leerer Text darf nicht als 0 durchgehen");
assert.throws(() => pruefe("kein json"));
const boese = pruefe(roh({ leaderName: "a\nb" + "x".repeat(200) }));
assert.ok(!boese.leaderName.includes("\n") && boese.leaderName.length <= 60);
assert.equal(pruefe(roh({ leaderName: null })).leaderName, "belobug", "ohne Namen: id");

// --- unterschiede ---
assert.deepEqual(unterschiede(null, neu), []);
assert.deepEqual(unterschiede({ ...neu }, neu), []);
assert.match(unterschiede({ ...neu, leader: 70.4 }, neu)[0], /⬆️ Ladebalken 70.4 % → 77.4 %/);
assert.match(unterschiede({ ...neu, leader: 80 }, neu)[0], /⬇️/);
assert.match(unterschiede({ ...neu, leaderId: "zettrox", leaderName: "ZETTROX" }, neu)[0], /Neuer Erster: Belobug \(vorher ZETTROX\)/);
assert.deepEqual(unterschiede(neu, pruefe(roh({ leader: 77.40000001 }))), [], "Rundungsrauschen");

// --- schritt: Ablauf ueber mehrere Laeufe ---
let s = schritt(null, roh({}));
assert.match(s.nachricht.title, /läuft/); assert.equal(s.state.fehlversuche, 0);
s = schritt(s.state, roh({}));
assert.equal(s.nachricht, null, "gleicher Stand: still");
s = schritt(s.state, roh({ leader: 81.2 }));
assert.match(s.nachricht.message, /77.4 % → 81.2 %/);

// Stoerung: still bis zur Grenze, dann genau EINE Warnung, danach wieder still
let st = s.state;
const warnungen = [];
for (let i = 1; i <= WARNEN_NACH + 5; i++) {
  const r = schritt(st, i % 2 ? "" : "kaputt");
  if (r.nachricht) warnungen.push(i);
  st = r.state;
  assert.equal(st.leader, 81.2, "Stand bleibt bei Fehlern erhalten");
}
assert.deepEqual(warnungen, [WARNEN_NACH]);
// Erholung: meldet "laeuft wieder", auch ohne Zahlenaenderung, und setzt Zaehler zurueck
s = schritt(st, roh({ leader: 81.2 }));
assert.match(s.nachricht.message, /läuft wieder/); assert.equal(s.state.fehlversuche, 0);
// kurze Stoerung (unter der Grenze) und Erholung: keine Meldung
s = schritt(schritt(s.state, "").state, roh({ leader: 81.2 }));
assert.equal(s.nachricht, null);
// Fehler schon beim allerersten Lauf: kein Absturz, kein Start-Text
s = schritt(null, "");
assert.equal(s.nachricht, null); assert.equal(s.state.fehlversuche, 1);
s = schritt(s.state, roh({}));
assert.match(s.nachricht.title, /läuft/, "erster gueltiger Lauf nach Fehlstart = Startmeldung");

console.log("alle Tests ok");
