import type { Match, Matchday } from "../types";

export function resolveActiveMatchdayId(
  manualId: string | undefined,
  matchdays: Matchday[],
  matches: Match[]
) {
  const validDays = matchdays
    .filter((day) => !day.deletedAt && !day.isHidden)
    .filter((day) => matches.some((match) => match.matchdayId === day.id))
    .sort((a, b) => a.number - b.number);
  const validIds = new Set(validDays.map((day) => day.id));

  const withResult = [...validDays]
    .reverse()
    .find((day) => matches.some((match) => match.matchdayId === day.id && Boolean(match.result)));
  if (withResult) return withResult.id;

  if (manualId && validIds.has(manualId)) return manualId;

  const scheduled = validDays.find((day) =>
    matches.some((match) => match.matchdayId === day.id && match.status === "da_giocare")
  );
  return scheduled?.id ?? validDays[0]?.id ?? null;
}
