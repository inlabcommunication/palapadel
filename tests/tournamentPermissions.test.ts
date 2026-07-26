import test from "node:test";
import assert from "node:assert/strict";
import { canPerformTournamentOperation } from "../shared/tournamentPermissions.js";

test("il Super Admin gestisce tutta la struttura del torneo", () => {
  for (const operation of ["createTournament", "createGroup", "addGroupTeam", "createRound", "createMatch", "updateMatch", "deleteTournament"]) {
    assert.equal(canPerformTournamentOperation("superAdmin", operation), true);
  }
});

test("l'Admin aggiorna gironi e incontri ma non crea la struttura", () => {
  assert.equal(canPerformTournamentOperation("admin", "updateGroupTeam"), true);
  assert.equal(canPerformTournamentOperation("admin", "updateMatch"), true);
  for (const operation of ["createTournament", "updateTournament", "createGroup", "addGroupTeam", "createRound", "createMatch", "deleteMatch"]) {
    assert.equal(canPerformTournamentOperation("admin", operation), false);
  }
});

test("il Result Manager non ha accesso operativo ai tornei", () => {
  assert.equal(canPerformTournamentOperation("resultManager", "updateGroupTeam"), false);
  assert.equal(canPerformTournamentOperation("resultManager", "updateMatch"), false);
});
