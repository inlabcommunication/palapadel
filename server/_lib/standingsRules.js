import {
  STANDING_POINTS_TABLE,
  getStandingPointsFromResult as getSharedStandingPointsFromResult,
} from "../../shared/standingPoints.js";

export const STANDING_POINTS = STANDING_POINTS_TABLE;

export function getStandingPointsFromResult(result) {
  return getSharedStandingPointsFromResult(result);
}

export function computeMatchTotals(matches) {
  const totals = new Map();
  for (const m of matches) {
    if (m.status !== "conclusa") continue;
    const pts = getStandingPointsFromResult(m.result);
    if (!pts) continue;

    const t1 = totals.get(m.team1Id) ?? { points: 0, played: 0 };
    t1.points += pts.team1;
    t1.played += 1;
    totals.set(m.team1Id, t1);

    const t2 = totals.get(m.team2Id) ?? { points: 0, played: 0 };
    t2.points += pts.team2;
    t2.played += 1;
    totals.set(m.team2Id, t2);
  }
  return totals;
}

export function computeMatchTotalsForTeam(matches, teamId) {
  return computeMatchTotals(matches).get(teamId) ?? { points: 0, played: 0 };
}

export function computeStandingsUpdates(editionTeamsDocs, allMatches) {
  const totals = computeMatchTotals(allMatches);

  return editionTeamsDocs.map((doc) => {
    const et = doc.data();
    const matchTotals = totals.get(et.teamId) ?? { points: 0, played: 0 };
    const manualPoints = et.manualPointsAdjustment ?? 0;
    const manualPlayed = et.manualPlayedAdjustment ?? 0;
    const baselinePoints = et.baselinePoints ?? Math.max(0, (et.points ?? 0) - matchTotals.points - manualPoints);
    const baselinePlayed = et.baselinePlayed ?? Math.max(0, (et.played ?? 0) - matchTotals.played - manualPlayed);
    const finalPoints = baselinePoints + matchTotals.points + manualPoints;
    const finalPlayed = baselinePlayed + matchTotals.played + manualPlayed;

    return {
      ref: doc.ref,
      teamId: et.teamId,
      fromPoints: et.points ?? 0,
      fromPlayed: et.played ?? 0,
      toPoints: finalPoints,
      toPlayed: finalPlayed,
      data: {
        baselinePoints,
        baselinePlayed,
        matchPoints: matchTotals.points,
        matchPlayed: matchTotals.played,
        points: finalPoints,
        played: finalPlayed,
      },
    };
  });
}
