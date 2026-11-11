import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSets, formatSets, getMatchGames, isValidSetScore } from "../shared/matchSets.js";
import { normalizeMatchChange } from "../server/_lib/matchStatus.js";

test("punteggi dei singoli set", () => {
  for (const [a, b] of [[6, 0], [6, 4], [4, 6], [7, 5], [7, 6], [6, 7]]) assert.equal(isValidSetScore(a, b), true, `${a}-${b}`);
  for (const [a, b] of [[6, 5], [5, 3], [6, 6], [7, 4], [8, 6], [-1, 6], [6.5, 2]]) assert.equal(isValidSetScore(a, b), false, `${a}-${b}`);
});

test("il risultato si ricava dai set e i game si sommano", () => {
  assert.deepEqual(evaluateSets([{ team1: 6, team2: 1 }, { team1: 4, team2: 6 }, { team1: 6, team2: 2 }]), {
    ok: true,
    result: "2-1",
    games: { team1: 16, team2: 9 },
  });
  assert.deepEqual(evaluateSets([{ team1: 3, team2: 6 }, { team1: 5, team2: 7 }]), {
    ok: true,
    result: "0-2",
    games: { team1: 8, team2: 13 },
  });
});

test("set mancanti o di troppo", () => {
  assert.equal(evaluateSets([{ team1: 6, team2: 1 }, { team1: 4, team2: 6 }]).ok, false);
  assert.equal(evaluateSets([{ team1: 6, team2: 1 }, { team1: 6, team2: 2 }, { team1: 6, team2: 3 }]).ok, false);
  assert.equal(evaluateSets([{ team1: 6, team2: 1 }]).ok, false);
  assert.equal(evaluateSets(null).ok, false);
});

test("game solo per partite concluse con set coerenti", () => {
  const sets = [{ team1: 6, team2: 1 }, { team1: 6, team2: 2 }];
  assert.deepEqual(getMatchGames({ status: "conclusa", result: "2-0", sets }), { team1: 12, team2: 3 });
  assert.equal(getMatchGames({ status: "da_giocare", result: "2-0", sets }), null);
  assert.equal(getMatchGames({ status: "conclusa", result: "2-1", sets }), null);
  assert.equal(getMatchGames({ status: "conclusa", result: "2-0" }), null);
  assert.equal(formatSets(sets), "6-1 6-2");
});

test("il server accetta i set e ricava il risultato", () => {
  const ok = normalizeMatchChange({ sets: [{ team1: 6, team2: 1 }, { team1: 4, team2: 6 }, { team1: 6, team2: 2 }] });
  assert.equal(ok.ok, true);
  assert.equal(ok.result, "2-1");
  assert.equal(ok.status, "conclusa");
  assert.equal(ok.sets.length, 3);
  assert.equal(normalizeMatchChange({ result: "2-0", sets: [{ team1: 6, team2: 1 }, { team1: 4, team2: 6 }, { team1: 6, team2: 2 }] }).ok, false);
  assert.equal(normalizeMatchChange({ sets: [{ team1: 6, team2: 5 }, { team1: 6, team2: 2 }] }).ok, false);
  const legacy = normalizeMatchChange({ result: "2-0" });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.sets, null);
  assert.equal(normalizeMatchChange({ status: "rinviata" }).sets, null);
});
