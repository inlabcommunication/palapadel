import { test } from "node:test";
import assert from "node:assert/strict";
import { areSameTeamIds } from "../server/_lib/matchValidation.js";

test("backend match validation blocks a team against itself", () => {
  assert.equal(areSameTeamIds("teamA", "teamA"), true);
  assert.equal(areSameTeamIds("teamA", "teamB"), false);
});
