import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateMatch,
  canCreateMatchday,
  canEditMatchSchedule,
  canEnrollExistingTeam,
  canManageChampionships,
  canManageNews,
  canManageResults,
  canShareMatchday,
  canShareStandings,
  canManageTournaments,
  canOperateTournaments,
} from "../shared/permissions.js";

test("Admin ha solo i permessi operativi previsti", () => {
  assert.equal(canManageResults("admin"), true);
  assert.equal(canCreateMatchday("admin"), true);
  assert.equal(canCreateMatch("admin"), true);
  assert.equal(canEnrollExistingTeam("admin"), true);
  assert.equal(canEditMatchSchedule("admin"), true);
  assert.equal(canManageNews("admin"), false);
  assert.equal(canManageChampionships("admin"), false);
  assert.equal(canManageTournaments("admin"), false);
  assert.equal(canOperateTournaments("admin"), true);
});

test("Result Manager non modifica struttura o calendario", () => {
  assert.equal(canManageResults("resultManager"), true);
  assert.equal(canCreateMatchday("resultManager"), false);
  assert.equal(canCreateMatch("resultManager"), false);
  assert.equal(canEnrollExistingTeam("resultManager"), false);
  assert.equal(canEditMatchSchedule("resultManager"), false);
  assert.equal(canOperateTournaments("resultManager"), false);
});

test("i tre ruoli operativi possono condividere", () => {
  for (const role of ["superAdmin", "admin", "resultManager"]) {
    assert.equal(canShareStandings(role), true);
    assert.equal(canShareMatchday(role), true);
  }
});
