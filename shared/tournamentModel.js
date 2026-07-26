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
