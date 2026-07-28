import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTeamName, matchTeamName, findDuplicateImportedNames } from "../src/lib/teamNameMatch.ts";

test("normalizeTeamName collassa spazi multipli, maiuscole/minuscole e punteggiatura", () => {
  assert.equal(normalizeTeamName("Team   Padel"), "team padel");
  assert.equal(normalizeTeamName("TEAM-PADEL"), "team padel");
  assert.equal(normalizeTeamName("Team's Padel!"), "team s padel");
});

test("normalizeTeamName rimuove gli accenti", () => {
  assert.equal(normalizeTeamName("Città Futura"), "citta futura");
});

test("matchTeamName riconosce una corrispondenza esatta", () => {
  const candidates = [{ id: "1", name: "Team Padel" }];
  const result = matchTeamName("Team Padel", candidates);
  assert.equal(result.kind, "exact");
});

test("matchTeamName riconosce una corrispondenza simile ma non esatta ('Team-Padel' vs 'Team Padel')", () => {
  const candidates = [{ id: "1", name: "Team Padel" }];
  const result = matchTeamName("Team-Padel", candidates);
  assert.equal(result.kind, "similar");
  if (result.kind === "similar") assert.equal(result.candidate.id, "1");
});

test("matchTeamName non unisce automaticamente nomi completamente diversi", () => {
  const candidates = [{ id: "1", name: "Team Padel" }];
  const result = matchTeamName("Bandeja Club", candidates);
  assert.equal(result.kind, "none");
});

test("findDuplicateImportedNames rileva righe duplicate nello stesso file dopo normalizzazione", () => {
  const duplicates = findDuplicateImportedNames(["Team Padel", "Smash Taranto", "TEAM-PADEL"]);
  assert.deepEqual(duplicates, ["TEAM-PADEL"]);
});

test("findDuplicateImportedNames non segnala nulla se i nomi sono tutti distinti", () => {
  const duplicates = findDuplicateImportedNames(["Team Padel", "Smash Taranto"]);
  assert.deepEqual(duplicates, []);
});
