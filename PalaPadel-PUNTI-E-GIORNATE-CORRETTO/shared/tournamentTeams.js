export function normalizeTournamentMember(value) {
  return String(value).trim().toLocaleLowerCase("it-IT").replace(/\s+/g, " ");
}

export function buildTournamentMemberKey(member1, member2) {
  return [normalizeTournamentMember(member1), normalizeTournamentMember(member2)].sort().join("|");
}

export function buildTournamentDisplayName(member1, member2) {
  return `${String(member1).trim()} / ${String(member2).trim()}`;
}
