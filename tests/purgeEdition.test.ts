import test from "node:test";
import assert from "node:assert/strict";
import { EDITION_DATA_COLLECTIONS, editionLabel, normalizeConfirmation } from "../server/admin/purge-edition.js";

test("la conferma ignora maiuscole e spazi in più ma non altri caratteri", () => {
  const label = editionLabel("Serie A", "2025/2026");
  assert.equal(label, "Serie A 2025/2026");
  assert.equal(normalizeConfirmation("  serie a   2025/2026 "), normalizeConfirmation(label));
  assert.notEqual(normalizeConfirmation("Serie A 2025"), normalizeConfirmation(label));
  assert.notEqual(normalizeConfirmation("Serie B 2025/2026"), normalizeConfirmation(label));
});

test("l'eliminazione definitiva copre tutti i dati di un'edizione ma non l'anagrafica squadre", () => {
  for (const name of ["editionTeams", "femaleParticipants", "matchdays", "matches", "bracketRounds", "bracketMatches"]) {
    assert.ok(EDITION_DATA_COLLECTIONS.includes(name), name);
  }
  assert.equal(EDITION_DATA_COLLECTIONS.includes("teams"), false);
  assert.equal(EDITION_DATA_COLLECTIONS.includes("historicalWins"), false);
});
