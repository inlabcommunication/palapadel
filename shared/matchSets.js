// Set e game di una partita (es. 6-1, 4-6, 6-2).
//
// Si gioca al meglio dei 3 set, tutti "normali": un set è valido se chi lo vince
// arriva a 6 giochi con almeno 2 di scarto (6-0 … 6-4) oppure a 7 (7-5 o 7-6 al
// tie-break). Il risultato in set ("2-0", "2-1", "1-2", "0-2") e quindi i punti in
// classifica si ricavano SEMPRE dai set, mai inseriti a parte.

export const MAX_SETS = 3;

function isGames(value) {
  return Number.isInteger(value) && value >= 0 && value <= 7;
}

/** true se il punteggio di un singolo set è possibile in un set normale. */
export function isValidSetScore(team1, team2) {
  if (!isGames(team1) || !isGames(team2) || team1 === team2) return false;
  const high = Math.max(team1, team2);
  const low = Math.min(team1, team2);
  if (high === 6) return low <= 4;
  if (high === 7) return low === 5 || low === 6;
  return false;
}

/**
 * Controlla i set di una partita e ne ricava risultato e game.
 * Ritorna { ok: true, result, games: { team1, team2 } } oppure { ok: false, error }.
 */
export function evaluateSets(sets) {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > MAX_SETS) {
    return { ok: false, error: "Servono 2 o 3 set" };
  }
  let won1 = 0;
  let won2 = 0;
  let games1 = 0;
  let games2 = 0;
  for (let i = 0; i < sets.length; i += 1) {
    const set = sets[i];
    if (won1 === 2 || won2 === 2) {
      return { ok: false, error: "La partita era già decisa: il terzo set non va inserito" };
    }
    if (!set || !isValidSetScore(set.team1, set.team2)) {
      return { ok: false, error: `Punteggio del set ${i + 1} non valido (es. 6-4, 7-5, 7-6)` };
    }
    if (set.team1 > set.team2) won1 += 1;
    else won2 += 1;
    games1 += set.team1;
    games2 += set.team2;
  }
  if (won1 !== 2 && won2 !== 2) {
    return { ok: false, error: "Set pari: inserisci anche il terzo set" };
  }
  return { ok: true, result: `${won1}-${won2}`, games: { team1: games1, team2: games2 } };
}

/**
 * Game di una partita conclusa con i set salvati, oppure null (partita non conclusa,
 * o vecchio risultato salvato senza set).
 */
export function getMatchGames(match) {
  if (!match || match.status !== "conclusa" || !match.sets) return null;
  const evaluated = evaluateSets(match.sets);
  if (!evaluated.ok || evaluated.result !== match.result) return null;
  return evaluated.games;
}

/** "6-1 4-6 6-2" (vuoto se non ci sono set). */
export function formatSets(sets) {
  if (!Array.isArray(sets)) return "";
  return sets.map((set) => `${set.team1}-${set.team2}`).join(" ");
}
