export const TOURNAMENT_STRUCTURE_OPERATIONS = Object.freeze(new Set([
  "createTournament", "updateTournament", "deleteTournament",
  "createGroup", "updateGroup", "deleteGroup", "addGroupTeam", "removeGroupTeam",
  "createRound", "updateRound", "deleteRound", "createMatch", "deleteMatch",
]));

export const TOURNAMENT_ADMIN_OPERATIONS = Object.freeze(new Set([
  "updateGroupTeam",
  "updateMatch",
]));

export function canPerformTournamentOperation(role, operation) {
  if (role === "superAdmin" || role === "superadmin") return true;
  if (role === "admin") return TOURNAMENT_ADMIN_OPERATIONS.has(operation);
  return false;
}
