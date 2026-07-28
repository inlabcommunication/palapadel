import type { Match } from "../types";

/**
 * Fase 9 — Una squadra può disputare al massimo una partita nella stessa giornata.
 * Verifica se team1/team2 (la nuova partita da creare) sono già presenti in una
 * qualunque partita esistente della stessa giornata, in un ordine qualsiasi (blocca
 * anche la partita duplicata con le squadre invertite e la coppia ripetuta).
 *
 * `existingMatches` deve contenere solo le partite già presenti in QUELLA giornata
 * (non di tutta l'edizione). Funzione pura, riusata sia dalla UI (src/pages/Giornate.tsx)
 * sia dai test automatici.
 */
export function findDuplicateTeamInMatchday(
  existingMatches: Pick<Match, "team1Id" | "team2Id">[],
  team1Id: string,
  team2Id: string
): { teamId: string } | null {
  for (const m of existingMatches) {
    if (m.team1Id === team1Id || m.team2Id === team1Id) return { teamId: team1Id };
    if (m.team1Id === team2Id || m.team2Id === team2Id) return { teamId: team2Id };
  }
  return null;
}

/** Fase 9 — una squadra non può giocare contro sé stessa. */
export function isSelfMatch(team1Id: string, team2Id: string): boolean {
  return !!team1Id && team1Id === team2Id;
}
