// Ordine della classifica a squadre. A parità, nell'ordine:
//   1. stato: prima le squadre in gara, poi ritirate/squalificate
//   2. punti (più alti prima)
//   3. partite giocate (meno partite prima: stessi punti in meno incontri)
//   4. scontri diretti: punti fatti nelle partite giocate SOLO tra le squadre ancora
//      pari (classifica avulsa, vale anche per 3 o più squadre)
//   5. differenza game (game vinti − game persi) in tutte le partite con i set salvati
//   6. ordine manuale deciso dall'amministratore (ultimo spareggio)
// Funzione pura, usata sia dall'app sia dal server (classifica congelata a fine stagione).

import { getMatchGames } from "./matchSets.js";
import { getStandingPointsFromResult } from "./standingPoints.js";

function isCounted(match) {
  return match.status === "conclusa" && getStandingPointsFromResult(match.result) !== null;
}

/** Game vinti/persi per squadra, solo dalle partite concluse con i set salvati. */
export function computeGamesByTeam(matches) {
  const games = new Map();
  const add = (teamId, won, lost) => {
    const current = games.get(teamId) ?? { gamesWon: 0, gamesLost: 0 };
    current.gamesWon += won;
    current.gamesLost += lost;
    games.set(teamId, current);
  };
  for (const match of matches) {
    if (!isCounted(match)) continue;
    const matchGames = getMatchGames(match);
    if (!matchGames) continue;
    add(match.team1Id, matchGames.team1, matchGames.team2);
    add(match.team2Id, matchGames.team2, matchGames.team1);
  }
  return games;
}

/** Punti fatti da ciascuna squadra del gruppo nelle partite giocate tra loro. */
function headToHeadPoints(teamIds, matches) {
  const group = new Set(teamIds);
  const points = new Map(teamIds.map((id) => [id, 0]));
  for (const match of matches) {
    if (!isCounted(match)) continue;
    if (!group.has(match.team1Id) || !group.has(match.team2Id)) continue;
    const pts = getStandingPointsFromResult(match.result);
    points.set(match.team1Id, points.get(match.team1Id) + pts.team1);
    points.set(match.team2Id, points.get(match.team2Id) + pts.team2);
  }
  return points;
}

const isOut = (row) => row.status !== "normale";

function samePrimaryKey(a, b) {
  return isOut(a) === isOut(b) && a.points === b.points && (a.played ?? 0) === (b.played ?? 0);
}

/**
 * Ordina le voci di classifica. Ogni voce ritorna arricchita con gamesWon,
 * gamesLost, gamesDiff, headToHeadPoints e tieGroup: due righe vicine con lo stesso
 * tieGroup sono pari in TUTTI i criteri, quindi l'ordine tra loro è quello manuale.
 */
export function rankStandings(entries, matches = []) {
  const games = computeGamesByTeam(matches);
  const rows = entries.map((entry) => {
    const g = games.get(entry.teamId) ?? { gamesWon: 0, gamesLost: 0 };
    return { ...entry, gamesWon: g.gamesWon, gamesLost: g.gamesLost, gamesDiff: g.gamesWon - g.gamesLost, headToHeadPoints: 0, tieGroup: "" };
  });

  rows.sort((a, b) => {
    if (isOut(a) !== isOut(b)) return isOut(a) ? 1 : -1;
    if (b.points !== a.points) return b.points - a.points;
    return (a.played ?? 0) - (b.played ?? 0);
  });

  const ranked = [];
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (end < rows.length && samePrimaryKey(rows[start], rows[end])) end += 1;
    const group = rows.slice(start, end);
    if (group.length > 1) {
      const h2h = headToHeadPoints(group.map((row) => row.teamId), matches);
      for (const row of group) row.headToHeadPoints = h2h.get(row.teamId) ?? 0;
      group.sort(
        (a, b) =>
          b.headToHeadPoints - a.headToHeadPoints ||
          b.gamesDiff - a.gamesDiff ||
          (a.order ?? 0) - (b.order ?? 0)
      );
    }
    for (const row of group) {
      row.tieGroup = `${isOut(row) ? 1 : 0}|${row.points}|${row.played ?? 0}|${row.headToHeadPoints}|${row.gamesDiff}`;
      ranked.push(row);
    }
    start = end;
  }
  return ranked;
}
