export type CanonicalRole = "superAdmin" | "admin" | "resultManager";
export type Permission =
  | "manageResults"
  | "changeMatchStatus"
  | "editOperationalStandings"
  | "enrollExistingTeam"
  | "createMatchday"
  | "createMatch"
  | "deleteMatch"
  | "editMatchSchedule"
  | "importSchedule"
  | "manageTeamRegistry"
  | "manageChampionships"
  | "manageNews"
  | "viewAnalytics"
  | "resetAnalytics"
  | "manageUsers"
  | "manageSettings"
  | "reorderChampionships"
  | "shareStandings"
  | "shareMatchday"
  | "manageHallOfFame"
  | "manageNotifications"
  | "sendNotifications"
  | "downloadBackup"
  | "viewAuditLog"
  | "undoOperation"
  | "closeEdition"
  | "manageTournaments"
  | "operateTournaments";

export const ROLES: Readonly<Record<"SUPER_ADMIN" | "ADMIN" | "RESULT_MANAGER", CanonicalRole>>;
export const PERMISSIONS: Readonly<Record<string, Permission>>;
export const ROLE_PERMISSIONS: Readonly<Record<CanonicalRole, readonly Permission[]>>;
export function normalizeRole(role: unknown): CanonicalRole | null;
export function hasPermission(role: unknown, permission: Permission): boolean;
export function canManageResults(role: unknown): boolean;
export function canChangeMatchStatus(role: unknown): boolean;
export function canEditOperationalStandings(role: unknown): boolean;
export function canEnrollExistingTeam(role: unknown): boolean;
export function canCreateMatchday(role: unknown): boolean;
export function canCreateMatch(role: unknown): boolean;
export function canDeleteMatch(role: unknown): boolean;
export function canEditMatchSchedule(role: unknown): boolean;
export function canImportSchedule(role: unknown): boolean;
export function canManageTeamRegistry(role: unknown): boolean;
export function canManageChampionships(role: unknown): boolean;
export function canManageNews(role: unknown): boolean;
export function canViewAnalytics(role: unknown): boolean;
export function canManageUsers(role: unknown): boolean;
export function canReorderChampionships(role: unknown): boolean;
export function canShareStandings(role: unknown): boolean;
export function canShareMatchday(role: unknown): boolean;
export function canManageTournaments(role: unknown): boolean;
export function canOperateTournaments(role: unknown): boolean;
export function canSendNotifications(role: unknown): boolean;
