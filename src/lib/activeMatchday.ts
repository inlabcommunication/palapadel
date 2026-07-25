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

  if (manualId && validIds.has(manualId)) return manualId;

  const completed = [...validDays]
    .reverse()
    .find((day) => matches.some((match) => match.matchdayId === day.id && match.status === "conclusa" && match.result));
  if (completed) return completed.id;

  const scheduled = validDays.find((day) =>
    matches.some((match) => match.matchdayId === day.id && match.status === "da_giocare")
  );
  return scheduled?.id ?? validDays[0]?.id ?? null;
}
