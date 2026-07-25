export {
  normalizeRole,
  hasPermission,
  PERMISSIONS,
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

import { normalizeRole } from "../../shared/permissions.js";

export function roleAllowed(role, allowedRoles) {
  const normalized = normalizeRole(role);
  return normalized !== null && allowedRoles.includes(normalized);
}
