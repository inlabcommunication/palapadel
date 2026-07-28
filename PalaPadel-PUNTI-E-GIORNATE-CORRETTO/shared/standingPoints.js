export const STANDING_POINTS_TABLE = Object.freeze({
  "2-0": Object.freeze({ team1: 3, team2: 0 }),
  "2-1": Object.freeze({ team1: 2, team2: 1 }),
  "1-2": Object.freeze({ team1: 1, team2: 2 }),
  "0-2": Object.freeze({ team1: 0, team2: 3 }),
});

export function getStandingPointsFromResult(result) {
  return result ? STANDING_POINTS_TABLE[result] ?? null : null;
}
