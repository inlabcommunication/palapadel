function normalizedRoundName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function findFinalBracketRound(rounds) {
  const sorted = [...rounds].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.find((round) => normalizedRoundName(round.name) === "finale") ?? sorted[sorted.length - 1];
}

export function findBracketWinnerMatch(rounds, matches) {
  const finalRound = findFinalBracketRound(rounds);
  if (!finalRound) return null;
  return (
    [...matches]
      .filter((match) => match.roundId === finalRound.id && match.winnerTeamId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null
  );
}
