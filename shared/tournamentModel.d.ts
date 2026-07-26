export type TournamentBracketMode = "unico" | "gold_silver";
export type TournamentBracketKey = "main" | "gold" | "silver";

export function getTournamentBracketKeys(mode: TournamentBracketMode): TournamentBracketKey[];
export function compareTournamentGroupEntries(
  a: { points: number; order: number },
  b: { points: number; order: number }
): number;
export function isPublicTournament(tournament: {
  status?: string;
  isPubliclyVisible?: boolean;
} | null | undefined): boolean;
export function filterTournamentTeamsInGroups<T extends { id: string }>(
  teams: T[],
  groupEntries: { teamId: string }[]
): T[];
