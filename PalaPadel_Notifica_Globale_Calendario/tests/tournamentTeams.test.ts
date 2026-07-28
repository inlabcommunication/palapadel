import test from "node:test";
import assert from "node:assert/strict";
import { buildTournamentDisplayName, buildTournamentMemberKey } from "../shared/tournamentTeams.js";

test("la coppia torneo mostra esclusivamente i nomi dei due membri", () => {
  assert.equal(buildTournamentDisplayName("Mario Rossi", "Luca Bianchi"), "Mario Rossi / Luca Bianchi");
});

test("la stessa coppia viene riconosciuta anche invertendo i membri", () => {
  assert.equal(
    buildTournamentMemberKey("Mario Rossi", "Luca Bianchi"),
    buildTournamentMemberKey(" luca   bianchi ", "MARIO ROSSI")
  );
});
