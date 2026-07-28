import test from "node:test";
import assert from "node:assert/strict";
import { findBracketWinnerMatch, findFinalBracketRound } from "../shared/bracketWinner.js";

test("la Finale esplicita prevale sull'ultimo turno creato", () => {
  const rounds = [
    { id: "semi", name: "Semifinale", order: 0 },
    { id: "final", name: "Finale", order: 1 },
    { id: "spareggio", name: "Spareggio", order: 2 },
  ];
  assert.equal(findFinalBracketRound(rounds)?.id, "final");
});

test("il vincitore del tabellone viene preso dall'incontro della Finale", () => {
  const rounds = [
    { id: "semi", name: "Semifinale", order: 0 },
    { id: "final", name: "Finale", order: 1 },
  ];
  const matches = [
    { id: "m1", roundId: "semi", order: 0, winnerTeamId: "team-a" },
    { id: "m2", roundId: "final", order: 0, winnerTeamId: "team-b" },
  ];
  assert.equal(findBracketWinnerMatch(rounds, matches)?.winnerTeamId, "team-b");
});

test("senza vincitore in Finale non viene inventato un campione", () => {
  const rounds = [{ id: "final", name: "Finale", order: 0 }];
  assert.equal(findBracketWinnerMatch(rounds, [{ id: "m", roundId: "final", order: 0 }]), null);
});
