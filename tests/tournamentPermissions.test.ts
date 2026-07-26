import test from "node:test";
import assert from "node:assert/strict";
import { canPerformTournamentOperation } from "../shared/tournamentPermissions.js";

test("il Super Admin gestisce tutta la struttura del torneo", () => {
  for (const operation of ["createTournament", "setTournamentLogo", "removeTournamentLogo", "createGroup", "addGroupTeam", "createRound", "createMatch", "updateMatch", "deleteTournament"]) {
    assert.equal(canPerformTournamentOperation("superAdmin", operation), true);
  }
});

test("l'Admin gestisce completamente la struttura interna del torneo", () => {
  for (const operation of [
    "createGroup", "updateGroup", "deleteGroup",
    "addGroupTeam", "updateGroupTeam", "removeGroupTeam",
    "createRound", "updateRound", "deleteRound",
    "createMatch", "updateMatch", "deleteMatch",
  ]) {
    assert.equal(canPerformTournamentOperation("admin", operation), true);
  }
  for (const operation of ["createTournament", "updateTournament", "deleteTournament", "setTournamentLogo", "removeTournamentLogo"]) {
    assert.equal(canPerformTournamentOperation("admin", operation), false);
  }
});

test("il Result Manager non ha accesso operativo ai tornei", () => {
  assert.equal(canPerformTournamentOperation("resultManager", "updateGroupTeam"), false);
  assert.equal(canPerformTournamentOperation("resultManager", "updateMatch"), false);
});
