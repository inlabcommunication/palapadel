import test from "node:test";
import assert from "node:assert/strict";
import { propagateBracketWinner, validateBracketSources } from "../shared/bracketProgression.js";

const bracket = () => new Map([
  ["semi-1", { id: "semi-1", team1Id: "a", team2Id: "b" }],
  ["semi-2", { id: "semi-2", team1Id: "c", team2Id: "d" }],
  ["final", {
    id: "final",
    team1SourceMatchId: "semi-1",
    team2SourceMatchId: "semi-2",
  }],
]);

test("il vincitore della semifinale viene inserito automaticamente nella finale", () => {
  const updates = propagateBracketWinner(bracket(), "semi-1", "a");
  assert.equal(updates.get("final")?.team1Id, "a");
  assert.equal(updates.get("final")?.team2Id, undefined);
});

test("i due vincitori delle semifinali compongono correttamente la finale", () => {
  const afterFirst = bracket();
  for (const [id, value] of propagateBracketWinner(afterFirst, "semi-1", "a")) afterFirst.set(id, value);
  const afterSecond = propagateBracketWinner(afterFirst, "semi-2", "d");
  assert.deepEqual(
    [afterSecond.get("final")?.team1Id, afterSecond.get("final")?.team2Id],
    ["a", "d"]
  );
});

test("cambiare un semifinalista elimina un vecchio vincitore della finale non piu valido", () => {
  const matches = bracket();
  matches.set("final", {
    ...matches.get("final"),
    team1Id: "a",
    team2Id: "d",
    winnerTeamId: "a",
  });
  const updates = propagateBracketWinner(matches, "semi-1", "b");
  assert.equal(updates.get("final")?.team1Id, "b");
  assert.equal(updates.get("final")?.winnerTeamId, null);
});

test("rimuovere il vincitore della semifinale svuota solo lo slot collegato", () => {
  const matches = bracket();
  matches.set("final", { ...matches.get("final"), team1Id: "a", team2Id: "d" });
  const updates = propagateBracketWinner(matches, "semi-1", null);
  assert.equal(updates.get("final")?.team1Id, null);
  assert.equal(updates.get("final")?.team2Id, "d");
});

test("riferimenti inesistenti e circolari vengono rifiutati", () => {
  const missing = new Map([["final", { id: "final", team1SourceMatchId: "missing" }]]);
  assert.throws(() => validateBracketSources(missing.get("final"), missing), /INVALID_BRACKET_SOURCE/);

  const circular = new Map([
    ["a", { id: "a", team1SourceMatchId: "b" }],
    ["b", { id: "b", team1SourceMatchId: "a" }],
  ]);
  assert.throws(() => validateBracketSources(circular.get("a"), circular), /CIRCULAR_BRACKET_SOURCE/);
});
