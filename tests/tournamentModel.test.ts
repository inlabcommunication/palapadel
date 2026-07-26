import test from "node:test";
import assert from "node:assert/strict";
import { compareTournamentGroupEntries, filterTournamentTeamsInGroups, getTournamentBracketKeys, isPublicTournament } from "../shared/tournamentModel.js";

test("un torneo puo avere un tabellone unico oppure Gold e Silver distinti", () => {
  assert.deepEqual(getTournamentBracketKeys("unico"), ["main"]);
  assert.deepEqual(getTournamentBracketKeys("gold_silver"), ["gold", "silver"]);
});

test("la classifica manuale ordina per punti e poi per ordine deciso dall'operatore", () => {
  const rows = [
    { id: "b", points: 8, order: 2 },
    { id: "a", points: 10, order: 3 },
    { id: "c", points: 8, order: 1 },
  ].sort(compareTournamentGroupEntries);
  assert.deepEqual(rows.map((row) => row.id), ["a", "c", "b"]);
});

test("bozze e tornei nascosti non sono pubblici", () => {
  assert.equal(isPublicTournament({ status: "bozza", isPubliclyVisible: true }), false);
  assert.equal(isPublicTournament({ status: "in_corso", isPubliclyVisible: false }), false);
  assert.equal(isPublicTournament({ status: "in_corso", isPubliclyVisible: true }), true);
  assert.equal(isPublicTournament({ status: "concluso", isPubliclyVisible: true }), true);
});

test("nei tabelloni sono proposte solo le coppie effettivamente presenti nei gironi", () => {
  const teams = [{ id: "girone-a" }, { id: "non-iscritta" }, { id: "girone-b" }];
  const entries = [{ teamId: "girone-a" }, { teamId: "girone-b" }];
  assert.deepEqual(filterTournamentTeamsInGroups(teams, entries).map((team) => team.id), ["girone-a", "girone-b"]);
});
