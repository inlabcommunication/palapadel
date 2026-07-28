export interface SharedStandingPoints {
  team1: number;
  team2: number;
}

export const STANDING_POINTS_TABLE: Readonly<Record<string, Readonly<SharedStandingPoints>>>;

export function getStandingPointsFromResult(result: string | undefined | null): SharedStandingPoints | null;
