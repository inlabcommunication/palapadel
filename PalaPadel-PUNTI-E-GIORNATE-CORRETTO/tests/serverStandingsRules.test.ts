import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STANDING_POINTS,
  computeMatchTotals,
  computeMatchTotalsForTeam,
  computeStandingsUpdates,
  getStandingPointsFromResult,
} from "../server/_lib/standingsRules.js";

function fakeEditionTeamDoc(id: string, data: Record<string, unknown>) {
  return {
    ref: { id },
    data: () => data,
  };
}

test("server standings rules expose the official 3/2-1/0 points table", () => {
  assert.deepEqual(STANDING_POINTS["2-0"], { team1: 3, team2: 0 });
  assert.deepEqual(STANDING_POINTS["2-1"], { team1: 2, team2: 1 });
  assert.deepEqual(STANDING_POINTS["1-2"], { team1: 1, team2: 2 });
  assert.deepEqual(STANDING_POINTS["0-2"], { team1: 0, team2: 3 });
  assert.equal(getStandingPointsFromResult("3-1"), null);
});

test("server standings rules compute match totals from concluded valid matches only", () => {
  const totals = computeMatchTotals([
    { team1Id: "A", team2Id: "B", status: "conclusa", result: "2-1" },
    { team1Id: "C", team2Id: "A", status: "conclusa", result: "1-2" },
    { team1Id: "A", team2Id: "D", status: "rinviata", result: "2-0" },
  ]);

  assert.deepEqual(totals.get("A"), { points: 4, played: 2 });
  assert.deepEqual(totals.get("B"), { points: 1, played: 1 });
  assert.deepEqual(totals.get("C"), { points: 1, played: 1 });
  assert.equal(totals.get("D"), undefined);
  assert.deepEqual(computeMatchTotalsForTeam([{ team1Id: "A", team2Id: "B", status: "conclusa", result: "0-2" }], "B"), {
    points: 3,
    played: 1,
  });
});

test("server standings updates preserve baseline and manual adjustments", () => {
  const [update] = computeStandingsUpdates(
    [
      fakeEditionTeamDoc("entryA", {
        teamId: "A",
        baselinePoints: 4,
        baselinePlayed: 2,
        manualPointsAdjustment: 1,
        manualPlayedAdjustment: 1,
        points: 0,
        played: 0,
      }),
    ],
    [
      { team1Id: "A", team2Id: "B", status: "conclusa", result: "2-0" },
      { team1Id: "C", team2Id: "A", status: "conclusa", result: "1-2" },
    ]
  );

  assert.deepEqual(update.data, {
    baselinePoints: 4,
    baselinePlayed: 2,
    matchPoints: 5,
    matchPlayed: 2,
    points: 10,
    played: 5,
  });
});
