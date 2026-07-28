import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTeamEditionStats } from "../src/lib/teamStats.ts";

test("calcola PG, vittorie e sconfitte solo dalle partite concluse dell'edizione corrente", () => {
  const stats = computeTeamEditionStats(
    [
      { team1Id: "A", team2Id: "B", status: "conclusa", result: "2-0" },
      { team1Id: "C", team2Id: "A", status: "conclusa", result: "2-1" },
      { team1Id: "A", team2Id: "D", status: "da_giocare", result: "2-0" },
      { team1Id: "A", team2Id: "E", status: "annullata", result: "2-0" },
      { team1Id: "F", team2Id: "A", status: "conclusa", result: "3-1" },
      { team1Id: "X", team2Id: "Y", status: "conclusa", result: "2-0" },
    ],
    "A"
  );

  assert.deepEqual(stats, { played: 2, wins: 1, losses: 1 });
});

test("accetta anche lo status API completed senza contare risultati non validi", () => {
  const stats = computeTeamEditionStats(
    [
      { team1Id: "A", team2Id: "B", status: "completed", result: "0-2" },
      { team1Id: "B", team2Id: "A", status: "completed", result: "2-1" },
      { team1Id: "A", team2Id: "C", status: "completed", result: null },
    ],
    "A"
  );

  assert.deepEqual(stats, { played: 2, wins: 0, losses: 2 });
});
