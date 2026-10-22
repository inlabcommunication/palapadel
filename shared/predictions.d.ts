export type Pick = "2-0" | "2-1" | "1-2" | "0-2";

export interface PredictionPeriodLike {
  id: string;
  name?: string;
  startDate: string;
  endDate: string;
  editionIds?: string[];
  closedAt?: string | null;
}

export interface MatchLike {
  editionId: string;
  status: string;
  result?: string | null;
  matchDate?: string;
  matchTime?: string;
  predictionsClosedAt?: string | null;
}

export interface LeaderboardEntryLike {
  points?: number;
  exact?: number;
  joinedAt?: string;
}

export const PICKS: readonly Pick[];
export const EXACT_POINTS: number;
export const WINNER_POINTS: number;
export const TIME_ZONE: string;
export function scorePrediction(pick: string, match: MatchLike | null | undefined): { points: number; exact: boolean } | null;
export function kickoffTime(matchDate?: string | null, matchTime?: string | null, timeZone?: string): number | null;
export function todayInItaly(now?: number): string;
export function isPredictionVoided(
  prediction: { updatedAt?: string; createdAt?: string } | null | undefined,
  match: MatchLike | null | undefined
): boolean;
export function isMatchOpen(match: MatchLike | null | undefined, now?: number): boolean;
export function currentPeriod<T extends PredictionPeriodLike>(periods: T[], now?: number): T | null;
export function periodForMatch<T extends PredictionPeriodLike>(periods: T[], match: MatchLike, now?: number): T | null;
export function sortLeaderboard<T extends LeaderboardEntryLike>(entries: T[]): T[];
export function normalizeNickname(value: unknown): string;
export function nicknameError(value: unknown): string | null;
