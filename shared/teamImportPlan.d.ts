export type TeamImportAction = "create" | "use" | "replace" | "copy" | "skip";

export interface ExistingTeamLike {
  id: string;
  name: string;
  roster?: string[];
  deletedAt?: string;
  compatibleTypeIds?: string[];
}

export interface RosterComparison {
  same: boolean;
  added: string[];
  removed: string[];
}

export interface PlannedTeamRow {
  existing: ExistingTeamLike | null;
  comparison: RosterComparison | null;
  enrolled: boolean;
  compatible: boolean;
  suggested: TeamImportAction | null;
}

export interface TeamImportDecision {
  name: string;
  roster: string[];
  action: TeamImportAction;
  existingTeamId?: string;
  copyName?: string;
}

export type TeamImportOperation =
  | { type: "create"; name: string; roster: string[]; enroll: boolean }
  | { type: "use" | "replace"; teamId: string; name: string; roster: string[]; previousRoster: string[]; enroll: boolean };

export const IMPORT_ACTIONS: readonly TeamImportAction[];
export function normalizeTeamKey(value: unknown): string;
export function compareRosters(fileRoster: string[], currentRoster?: string[]): RosterComparison;
export function planTeamImport<Row extends { name: string; roster: string[] }>(
  rows: Row[],
  existingTeams: ExistingTeamLike[],
  options?: { enrolledTeamIds?: string[]; typeId?: string | null }
): (Row & PlannedTeamRow)[];
export function suggestCopyName(name: string, takenNames: Iterable<string>): string;
export function resolveTeamImport(
  decisions: TeamImportDecision[],
  existingTeams: ExistingTeamLike[],
  options?: { enrolledTeamIds?: string[]; typeId?: string | null }
): { errors: string[]; operations: TeamImportOperation[] };
