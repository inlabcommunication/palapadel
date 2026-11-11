import test from "node:test";
import assert from "node:assert/strict";
import { rankStandings } from "../shared/standingsRanking.js";

const entry = (teamId: string, points: number, played: number, extra: Record<string, unknown> = {}) => ({
  teamId,
  points,
  played,
  status: "normale",
  order: 0,
  ...extra,
});
const match = (team1Id: string, team2Id: string, sets: [number, number][]) => {
  const won1 = sets.filter(([a, b]) => a > b).length;
  return {
    team1Id,
    team2Id,
    status: "conclusa",
    result: `${won1}-${sets.length - won1}`,
    sets: sets.map(([team1, team2]) => ({ team1, team2 })),
  };
};
const order = (rows: { teamId: string }[]) => rows.map((row) => row.teamId);

test("prima i punti, poi meno partite giocate", () => {
  const rows = rankStandings([entry("A", 6, 4), entry("B", 6, 3), entry("C", 9, 4)], []);
  assert.deepEqual(order(rows), ["C", "B", "A"]);
});

test("a pari punti e partite decide lo scontro diretto, anche contro la differenza game", () => {
  const matches = [
    match("A", "B", [[6, 4], [6, 4]]), // A batte B
    match("B", "C", [[6, 0], [6, 0]]), // B stravince
    match("A", "C", [[4, 6], [4, 6]]), // A perde
  ];
  // A e B: 3 punti, 2 partite ciascuna. B ha differenza game migliore (+8 contro -4),
  // ma A ha vinto lo scontro diretto.
  const rows = rankStandings([entry("B", 3, 2), entry("A", 3, 2), entry("C", 3, 3)], matches);
  assert.deepEqual(order(rows), ["A", "B", "C"]);
  assert.ok(rows[1].gamesDiff > rows[0].gamesDiff);
});

test("classifica avulsa a tre e poi differenza game", () => {
  // Tre squadre che si battono a vicenda 2-0: scontri diretti pari, decide la differenza game.
  const matches = [
    match("A", "B", [[6, 0], [6, 0]]), // A +12
    match("B", "C", [[6, 4], [6, 4]]), // B +4
    match("C", "A", [[6, 3], [6, 3]]), // C +6
  ];
  const rows = rankStandings([entry("A", 3, 2), entry("B", 3, 2), entry("C", 3, 2)], matches);
  // A: +12 -6 = +6; B: -12 +4 = -8; C: -4 +6 = +2
  assert.deepEqual(order(rows), ["A", "C", "B"]);
  assert.deepEqual(rows.map((row) => row.gamesDiff), [6, 2, -8]);
});

test("ordine manuale solo se pari in tutto, squadre ritirate in fondo", () => {
  const rows = rankStandings(
    [entry("A", 0, 0, { order: 2 }), entry("B", 0, 0, { order: 1 }), entry("X", 9, 3, { status: "ritirata" })],
    []
  );
  assert.deepEqual(order(rows), ["B", "A", "X"]);
  assert.equal(rows[0].tieGroup, rows[1].tieGroup);
  assert.notEqual(rows[1].tieGroup, rows[2].tieGroup);
});

test("i vecchi risultati senza set contano per gli scontri diretti ma non per i game", () => {
  const matches = [{ team1Id: "A", team2Id: "B", status: "conclusa", result: "0-2" }];
  const rows = rankStandings([entry("A", 3, 1), entry("B", 3, 1)], matches);
  assert.deepEqual(order(rows), ["B", "A"]);
  assert.equal(rows[0].gamesDiff, 0);
});
