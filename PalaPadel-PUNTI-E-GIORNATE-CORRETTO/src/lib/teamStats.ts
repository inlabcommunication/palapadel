export interface TeamEditionStats {
  played: number;
  wins: number;
  losses: number;
}

export interface TeamStatsMatch {
  team1Id: string;
  team2Id: string;
  status: string;
  result?: string | null;
}

const COMPLETED_STATUSES = new Set(["conclusa", "completed"]);
const WINNERS_BY_RESULT: Record<string, 1 | 2> = {
  "2-0": 1,
  "2-1": 1,
  "1-2": 2,
  "0-2": 2,
};

export function computeTeamEditionStats(matches: TeamStatsMatch[], teamId: string): TeamEditionStats {
  const stats: TeamEditionStats = { played: 0, wins: 0, losses: 0 };

  for (const match of matches) {
    const isTeam1 = match.team1Id === teamId;
    const isTeam2 = match.team2Id === teamId;
    if (!isTeam1 && !isTeam2) continue;
    if (!COMPLETED_STATUSES.has(match.status)) continue;

    const winnerSide = match.result ? WINNERS_BY_RESULT[match.result] : undefined;
    if (!winnerSide) continue;

    const won = isTeam1 ? winnerSide === 1 : winnerSide === 2;
    stats.played += 1;
    if (won) stats.wins += 1;
    else stats.losses += 1;
  }

  return stats;
}
