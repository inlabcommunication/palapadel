export interface SetScore {
  team1: number;
  team2: number;
}

export type MatchResult = "2-0" | "2-1" | "1-2" | "0-2";

export const MAX_SETS: number;

export function isValidSetScore(team1: number, team2: number): boolean;

export function evaluateSets(
  sets: readonly SetScore[] | null | undefined
): { ok: true; result: MatchResult; games: SetScore } | { ok: false; error: string };

export function getMatchGames(
  match: { status: string; result?: string | null; sets?: readonly SetScore[] | null } | null | undefined
): SetScore | null;

export function formatSets(sets: readonly SetScore[] | null | undefined): string;
