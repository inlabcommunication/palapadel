export function getTournamentBracketKeys(mode) {
  return mode === "gold_silver" ? ["gold", "silver"] : ["main"];
}

export function compareTournamentGroupEntries(a, b) {
  return b.points - a.points || a.order - b.order;
}

export function isPublicTournament(tournament) {
  return tournament?.isPubliclyVisible === true &&
    ["in_corso", "concluso"].includes(tournament.status);
}

export function filterTournamentTeamsInGroups(teams, groupEntries) {
  const enrolledIds = new Set(groupEntries.map((entry) => entry.teamId));
  return teams.filter((team) => enrolledIds.has(team.id));
}
