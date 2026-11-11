export interface RankableEntry {
  teamId: string;
  points: number;
  played?: number;
  status: string;
  order?: number;
}

export interface RankableMatch {
  team1Id: string;
  team2Id: string;
  status: string;
  result?: string | null;
  sets?: readonly { team1: number; team2: number }[] | null;
}

export type RankedEntry<T> = T & {
  gamesWon: number;
  gamesLost: number;
  gamesDiff: number;
  headToHeadPoints: number;
  tieGroup: string;
};

export function computeGamesByTeam(matches: readonly RankableMatch[]): Map<string, { gamesWon: number; gamesLost: number }>;

export function rankStandings<T extends RankableEntry>(entries: readonly T[], matches?: readonly RankableMatch[]): RankedEntry<T>[];
