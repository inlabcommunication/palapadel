export const ROLES = Object.freeze({
  SUPER_ADMIN: "superAdmin",
  ADMIN: "admin",
  RESULT_MANAGER: "resultManager",
});

export const PERMISSIONS = Object.freeze({
  MANAGE_RESULTS: "manageResults",
  CHANGE_MATCH_STATUS: "changeMatchStatus",
  EDIT_OPERATIONAL_STANDINGS: "editOperationalStandings",
  ENROLL_EXISTING_TEAM: "enrollExistingTeam",
  CREATE_MATCHDAY: "createMatchday",
  CREATE_MATCH: "createMatch",
  DELETE_MATCH: "deleteMatch",
  EDIT_MATCH_SCHEDULE: "editMatchSchedule",
  IMPORT_SCHEDULE: "importSchedule",
  MANAGE_TEAM_REGISTRY: "manageTeamRegistry",
  MANAGE_CHAMPIONSHIPS: "manageChampionships",
  MANAGE_NEWS: "manageNews",
  VIEW_ANALYTICS: "viewAnalytics",
  RESET_ANALYTICS: "resetAnalytics",
  MANAGE_USERS: "manageUsers",
  MANAGE_SETTINGS: "manageSettings",
  REORDER_CHAMPIONSHIPS: "reorderChampionships",
  SHARE_STANDINGS: "shareStandings",
  SHARE_MATCHDAY: "shareMatchday",
  MANAGE_HALL_OF_FAME: "manageHallOfFame",
  MANAGE_NOTIFICATIONS: "manageNotifications",
  SEND_NOTIFICATIONS: "sendNotifications",
  DOWNLOAD_BACKUP: "downloadBackup",
  VIEW_AUDIT_LOG: "viewAuditLog",
  UNDO_OPERATION: "undoOperation",
  CLOSE_EDITION: "closeEdition",
  MANAGE_TOURNAMENTS: "manageTournaments",
  OPERATE_TOURNAMENTS: "operateTournaments",
});

const SUPER_ADMIN_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));
const ADMIN_PERMISSIONS = Object.freeze([
  PERMISSIONS.MANAGE_RESULTS,
  PERMISSIONS.CHANGE_MATCH_STATUS,
  PERMISSIONS.EDIT_OPERATIONAL_STANDINGS,
  PERMISSIONS.ENROLL_EXISTING_TEAM,
  PERMISSIONS.CREATE_MATCHDAY,
  PERMISSIONS.CREATE_MATCH,
  PERMISSIONS.DELETE_MATCH,
  PERMISSIONS.EDIT_MATCH_SCHEDULE,
  PERMISSIONS.SHARE_STANDINGS,
  PERMISSIONS.SHARE_MATCHDAY,
  PERMISSIONS.OPERATE_TOURNAMENTS,
  PERMISSIONS.SEND_NOTIFICATIONS,
]);
const RESULT_MANAGER_PERMISSIONS = Object.freeze([
  PERMISSIONS.MANAGE_RESULTS,
  PERMISSIONS.CHANGE_MATCH_STATUS,
  PERMISSIONS.EDIT_OPERATIONAL_STANDINGS,
  PERMISSIONS.SHARE_STANDINGS,
  PERMISSIONS.SHARE_MATCHDAY,
]);

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.RESULT_MANAGER]: RESULT_MANAGER_PERMISSIONS,
});

export function normalizeRole(role) {
  if (role === "superAdmin" || role === "superadmin") return ROLES.SUPER_ADMIN;
  if (role === "admin") return ROLES.ADMIN;
  if (role === "resultManager" || role === "gestore") return ROLES.RESULT_MANAGER;
  return null;
}

export function hasPermission(role, permission) {
  const normalized = normalizeRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized].includes(permission) : false;
}

export const canManageResults = (role) => hasPermission(role, PERMISSIONS.MANAGE_RESULTS);
export const canChangeMatchStatus = (role) => hasPermission(role, PERMISSIONS.CHANGE_MATCH_STATUS);
export const canEditOperationalStandings = (role) => hasPermission(role, PERMISSIONS.EDIT_OPERATIONAL_STANDINGS);
export const canEnrollExistingTeam = (role) => hasPermission(role, PERMISSIONS.ENROLL_EXISTING_TEAM);
export const canCreateMatchday = (role) => hasPermission(role, PERMISSIONS.CREATE_MATCHDAY);
export const canCreateMatch = (role) => hasPermission(role, PERMISSIONS.CREATE_MATCH);
export const canDeleteMatch = (role) => hasPermission(role, PERMISSIONS.DELETE_MATCH);
export const canEditMatchSchedule = (role) => hasPermission(role, PERMISSIONS.EDIT_MATCH_SCHEDULE);
export const canImportSchedule = (role) => hasPermission(role, PERMISSIONS.IMPORT_SCHEDULE);
export const canManageTeamRegistry = (role) => hasPermission(role, PERMISSIONS.MANAGE_TEAM_REGISTRY);
export const canManageChampionships = (role) => hasPermission(role, PERMISSIONS.MANAGE_CHAMPIONSHIPS);
export const canManageNews = (role) => hasPermission(role, PERMISSIONS.MANAGE_NEWS);
export const canViewAnalytics = (role) => hasPermission(role, PERMISSIONS.VIEW_ANALYTICS);
export const canManageUsers = (role) => hasPermission(role, PERMISSIONS.MANAGE_USERS);
export const canReorderChampionships = (role) => hasPermission(role, PERMISSIONS.REORDER_CHAMPIONSHIPS);
export const canShareStandings = (role) => hasPermission(role, PERMISSIONS.SHARE_STANDINGS);
export const canShareMatchday = (role) => hasPermission(role, PERMISSIONS.SHARE_MATCHDAY);
export const canManageTournaments = (role) => hasPermission(role, PERMISSIONS.MANAGE_TOURNAMENTS);
export const canOperateTournaments = (role) => hasPermission(role, PERMISSIONS.OPERATE_TOURNAMENTS);
export const canSendNotifications = (role) => hasPermission(role, PERMISSIONS.SEND_NOTIFICATIONS);
