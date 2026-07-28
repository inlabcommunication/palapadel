import type { BracketMatch, BracketRound } from "../types";

export function resolveActiveBracketRoundId(
  rounds: BracketRound[],
  matches: BracketMatch[]
): string | null {
  const orderedRounds = [...rounds].sort((a, b) => a.order - b.order);
  const readyRounds = orderedRounds.filter((round) => {
    const roundMatches = matches.filter((match) => match.roundId === round.id);
    return roundMatches.length > 0 && roundMatches.every((match) => match.team1Id && match.team2Id);
  });

  return (
    readyRounds.at(-1)?.id ??
    orderedRounds.find((round) => matches.some((match) => match.roundId === round.id))?.id ??
    orderedRounds[0]?.id ??
    null
  );
}
