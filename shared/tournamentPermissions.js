export const TOURNAMENT_STRUCTURE_OPERATIONS = Object.freeze(new Set([
  "createTournament", "updateTournament", "deleteTournament",
  "setTournamentLogo", "removeTournamentLogo",
  "createGroup", "updateGroup", "deleteGroup", "addGroupTeam", "removeGroupTeam",
  "createRound", "updateRound", "deleteRound", "createMatch", "deleteMatch",
]));

export const TOURNAMENT_ADMIN_OPERATIONS = Object.freeze(new Set([
  "createGroup", "updateGroup", "deleteGroup",
  "addGroupTeam", "updateGroupTeam", "removeGroupTeam",
  "createRound", "updateRound", "deleteRound",
  "createMatch", "updateMatch", "deleteMatch",
]));

export function canPerformTournamentOperation(role, operation) {
  if (role === "superAdmin" || role === "superadmin") return true;
  if (role === "admin") return TOURNAMENT_ADMIN_OPERATIONS.has(operation);
  return false;
}
