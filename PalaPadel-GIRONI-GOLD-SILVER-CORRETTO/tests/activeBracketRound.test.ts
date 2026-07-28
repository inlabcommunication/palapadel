import assert from "node:assert/strict";
import test from "node:test";
import { resolveActiveBracketRoundId } from "../src/lib/activeBracketRound.ts";

const rounds = [
  { id: "qualificazioni", editionId: "e1", name: "Qualificazioni", order: 0 },
  { id: "quarti", editionId: "e1", name: "Quarti", order: 1 },
];

test("resta sul turno precedente finche il successivo non e completo", () => {
  const matches = [
    { id: "q1", editionId: "e1", roundId: "qualificazioni", order: 0, team1Id: "a", team2Id: "b" },
    { id: "q2", editionId: "e1", roundId: "quarti", order: 0, team1Id: "a" },
  ];

  assert.equal(resolveActiveBracketRoundId(rounds, matches), "qualificazioni");
});

test("apre il turno piu avanzato quando tutti gli incontri hanno entrambe le squadre", () => {
  const matches = [
    { id: "q1", editionId: "e1", roundId: "qualificazioni", order: 0, team1Id: "a", team2Id: "b" },
    { id: "q2", editionId: "e1", roundId: "quarti", order: 0, team1Id: "a", team2Id: "c" },
  ];

  assert.equal(resolveActiveBracketRoundId(rounds, matches), "quarti");
});
