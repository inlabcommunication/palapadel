import test from "node:test";
import assert from "node:assert/strict";
import { bodySchema } from "../server/standings/manage-entry.js";

test("manage-entry accetta l'iscrizione di una squadra esistente", () => {
  const result = bodySchema.safeParse({
    op: "add",
    editionId: "edition-1",
    teamId: "team-1",
  });
  assert.equal(result.success, true);
});

test("manage-entry accetta l'iscrizione multipla", () => {
  const result = bodySchema.safeParse({
    op: "addBulk",
    editionId: "edition-1",
    teamIds: ["team-1", "team-2"],
  });
  assert.equal(result.success, true);
});

test("manage-entry accetta la creazione e iscrizione di una nuova squadra", () => {
  const result = bodySchema.safeParse({
    op: "add",
    editionId: "edition-1",
    newTeam: {
      name: "Nuova squadra",
      roster: ["Giocatore 1", "Giocatore 2"],
    },
  });
  assert.equal(result.success, true);
});
