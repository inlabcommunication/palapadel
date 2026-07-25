import type { Role } from "../types";
import {
  PERMISSIONS,
  hasPermission,
  canManageResults,
  canChangeMatchStatus,
  canEditOperationalStandings,
  canEnrollExistingTeam,
  canCreateMatchday,
  canCreateMatch,
  canDeleteMatch,
  canEditMatchSchedule,
  canImportSchedule,
  canManageTeamRegistry,
  canManageChampionships,
  canManageNews,
  canViewAnalytics,
  canManageUsers,
  canReorderChampionships,
  canShareStandings,
  canShareMatchday,
} from "../../shared/permissions.js";

export {
  PERMISSIONS,
  hasPermission,
  canManageResults,
  canChangeMatchStatus,
  canEditOperationalStandings,
  canEnrollExistingTeam,
  canCreateMatchday,
  canCreateMatch,
  canDeleteMatch,
  canEditMatchSchedule,
  canImportSchedule,
  canManageTeamRegistry,
  canManageChampionships,
  canManageNews,
  canViewAnalytics,
  canManageUsers,
  canReorderChampionships,
  canShareStandings,
  canShareMatchday,
};

export interface Permissions {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isResultManager: boolean;
  canCreateMatches: boolean;
  canDeleteMatches: boolean;
  canEditResults: boolean;
  canManageMatchdays: boolean;
  canCreateHomeNewsDraft: boolean;
  canChangeMatchStatus: boolean;
  canEditOperationalStandings: boolean;
  canEnrollExistingTeam: boolean;
  canEditMatchSchedule: boolean;
  canShareStandings: boolean;
  canShareMatchday: boolean;
}

export function derivePermissions(role: Role | undefined | null): Permissions {
  return {
    isSuperAdmin: role === "superAdmin",
    isAdmin: role === "superAdmin" || role === "admin",
    isResultManager: role === "resultManager",
    canCreateMatches: canCreateMatch(role),
    canDeleteMatches: canDeleteMatch(role),
    canEditResults: canManageResults(role),
    canManageMatchdays: canCreateMatchday(role),
    canCreateHomeNewsDraft: canManageNews(role),
    canChangeMatchStatus: canChangeMatchStatus(role),
    canEditOperationalStandings: canEditOperationalStandings(role),
    canEnrollExistingTeam: canEnrollExistingTeam(role),
    canEditMatchSchedule: canEditMatchSchedule(role),
    canShareStandings: canShareStandings(role),
    canShareMatchday: canShareMatchday(role),
  };
}

export function canResetAnalytics(role: Role | null | undefined) {
  return hasPermission(role, PERMISSIONS.RESET_ANALYTICS);
}
