import test from "node:test";
import assert from "node:assert/strict";
import { parseTeamImportRows } from "../src/lib/teamImportParser.ts";

test("import squadre legge intestazione, nome e rosa", () => {
  const result = parseTeamImportRows([
    ["Nome squadra", "Giocatore 1", "Giocatore 2", "Giocatore 3"],
    ["Padel Team", "Anna", "Luca", "Marco"],
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.teams[0], {
    rowNumber: 2,
    name: "Padel Team",
    roster: ["Anna", "Luca", "Marco"],
  });
});

test("import squadre blocca rose con meno di due giocatori", () => {
  const result = parseTeamImportRows([["Squadra A", "Anna"]]);
  assert.equal(result.teams.length, 0);
  assert.match(result.errors[0], /2 a 6 giocatori/);
});

test("import squadre riconosce duplicati normalizzati", () => {
  const result = parseTeamImportRows([
    ["I Campioni", "A", "B"],
    ["  i-campióni ", "C", "D"],
  ]);
  assert.equal(result.teams.length, 1);
  assert.match(result.errors[0], /duplica/);
});
