import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getStandingPointsFromResult,
  matchContributesToStandings,
  computeMatchTotals,
} from "../src/lib/standingsEngine.ts";
import { findDuplicateTeamInMatchday, isSelfMatch } from "../src/lib/matchdayValidation.ts";

// --- Fase 2: conversione risultato -> punti classifica --------------------------------

test("2-0 assegna 3 punti alla squadra1 e 0 alla squadra2", () => {
  assert.deepEqual(getStandingPointsFromResult("2-0"), { team1: 3, team2: 0 });
});

test("2-1 assegna 2 punti alla squadra1 e 1 alla squadra2", () => {
  assert.deepEqual(getStandingPointsFromResult("2-1"), { team1: 2, team2: 1 });
});

test("1-2 assegna 1 punto alla squadra1 e 2 alla squadra2", () => {
  assert.deepEqual(getStandingPointsFromResult("1-2"), { team1: 1, team2: 2 });
});

test("0-2 assegna 0 punti alla squadra1 e 3 alla squadra2", () => {
  assert.deepEqual(getStandingPointsFromResult("0-2"), { team1: 0, team2: 3 });
});

test("un risultato assente o non valido non restituisce punti", () => {
  assert.equal(getStandingPointsFromResult(undefined), null);
  assert.equal(getStandingPointsFromResult("3-1"), null);
});

// --- Fase 2/10: una partita assegna punti solo se conclusa con risultato valido -------

test("una partita rinviata non assegna punti anche se ha un vecchio risultato residuo", () => {
  assert.equal(matchContributesToStandings({ status: "rinviata", result: "2-0" }), false);
});

test("una partita annullata non assegna punti anche se ha un vecchio risultato residuo", () => {
  assert.equal(matchContributesToStandings({ status: "annullata", result: "2-0" }), false);
});

test("una partita da_giocare non assegna punti", () => {
  assert.equal(matchContributesToStandings({ status: "da_giocare", result: undefined }), false);
});

test("una partita conclusa con risultato valido assegna punti", () => {
  assert.equal(matchContributesToStandings({ status: "conclusa", result: "2-1" }), true);
});

// --- Fase 5/19 Scenario 2: la correzione di un risultato ricalcola da zero ------------

test("computeMatchTotals: correggere un risultato da 2-0 a 1-2 non lascia residui del vecchio risultato", () => {
  const beforeCorrection = [
    { team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-0" as const },
  ];
  const afterCorrection = [
    { team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "1-2" as const },
  ];
  const totalsBefore = computeMatchTotals(beforeCorrection);
  assert.deepEqual(totalsBefore.get("A"), { points: 3, played: 1 });
  assert.deepEqual(totalsBefore.get("B"), { points: 0, played: 1 });

  const totalsAfter = computeMatchTotals(afterCorrection);
  assert.deepEqual(totalsAfter.get("A"), { points: 1, played: 1 });
  assert.deepEqual(totalsAfter.get("B"), { points: 2, played: 1 });
});

test("computeMatchTotals: una partita conclusa che diventa annullata smette di assegnare punti", () => {
  const totals = computeMatchTotals([
    { team1Id: "A", team2Id: "B", status: "annullata" as const, result: undefined },
  ]);
  assert.equal(totals.get("A"), undefined);
  assert.equal(totals.get("B"), undefined);
});

test("computeMatchTotals: somma corretta su più giornate/partite per la stessa squadra", () => {
  const totals = computeMatchTotals([
    { team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-0" as const },
    { team1Id: "C", team2Id: "A", status: "conclusa" as const, result: "0-2" as const },
  ]);
  // A: 3 punti (2-0 come squadra1) + 3 punti (0-2 come squadra2) = 6, 2 partite
  assert.deepEqual(totals.get("A"), { points: 6, played: 2 });
  assert.deepEqual(totals.get("B"), { points: 0, played: 1 });
  assert.deepEqual(totals.get("C"), { points: 0, played: 1 });
});

// --- Fase 9: squadre duplicate nella stessa giornata ----------------------------------

test("blocca una squadra già presente in un'altra partita della stessa giornata", () => {
  const existing = [{ team1Id: "A", team2Id: "B" }];
  assert.deepEqual(findDuplicateTeamInMatchday(existing, "A", "C"), { teamId: "A" });
});

test("blocca la stessa coppia di squadre inserita con ordine invertito", () => {
  const existing = [{ team1Id: "A", team2Id: "B" }];
  assert.deepEqual(findDuplicateTeamInMatchday(existing, "B", "A"), { teamId: "B" });
});

test("non blocca due squadre entrambe libere in questa giornata", () => {
  const existing = [{ team1Id: "A", team2Id: "B" }];
  assert.equal(findDuplicateTeamInMatchday(existing, "C", "D"), null);
});

test("blocca una squadra contro sé stessa", () => {
  assert.equal(isSelfMatch("A", "A"), true);
  assert.equal(isSelfMatch("A", "B"), false);
});
