import test from "node:test";
import assert from "node:assert/strict";
import { compareRosters, planTeamImport, resolveTeamImport, suggestCopyName } from "../shared/teamImportPlan.js";

const existing = [
  { id: "t1", name: "Padel Lions", roster: ["Anna Rossi", "Luca Bianchi"] },
  { id: "t2", name: "Smash Team", roster: ["Marco Verdi", "Sara Neri"] },
  { id: "t3", name: "Vecchia", roster: ["A", "B"], deletedAt: "2026-01-01" },
];

test("le rose si confrontano senza ordine, maiuscole o accenti", () => {
  assert.deepEqual(compareRosters(["luca bianchi", "ANNA ROSSI"], ["Anna Rossi", "Luca Bianchi"]), { same: true, added: [], removed: [] });
  assert.deepEqual(compareRosters(["Anna Rossi", "Paolo Gialli"], ["Anna Rossi", "Luca Bianchi"]), {
    same: false,
    added: ["Paolo Gialli"],
    removed: ["Luca Bianchi"],
  });
});

test("l'anteprima distingue squadre nuove, uguali e con giocatori diversi", () => {
  const plan = planTeamImport(
    [
      { name: "Nuova Squadra", roster: ["X", "Y"] },
      { name: "padel-lions", roster: ["Luca Bianchi", "Anna Rossi"] },
      { name: "Smash Team", roster: ["Marco Verdi", "Paolo Gialli"] },
      { name: "Vecchia", roster: ["A", "B"] },
    ],
    existing,
    { enrolledTeamIds: ["t1"] }
  );
  assert.equal(plan[0].suggested, "create");
  assert.equal(plan[1].existing?.id, "t1");
  assert.equal(plan[1].suggested, "use");
  assert.equal(plan[1].enrolled, true);
  assert.equal(plan[2].comparison?.same, false);
  assert.equal(plan[2].suggested, null);
  // Le squadre eliminate non contano come doppioni.
  assert.equal(plan[3].existing, null);
});

test("le scelte diventano operazioni: crea, usa, sostituisci, copia, salta", () => {
  const { errors, operations } = resolveTeamImport(
    [
      { name: "Nuova Squadra", roster: ["X", "Y"], action: "create" },
      { name: "Padel Lions", roster: ["Anna Rossi", "Luca Bianchi"], action: "use", existingTeamId: "t1" },
      { name: "Smash Team", roster: ["Marco Verdi", "Paolo Gialli"], action: "replace", existingTeamId: "t2" },
    ],
    existing,
    { enrolledTeamIds: ["t1"] }
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(operations.map((op) => [op.type, op.enroll]), [["create", true], ["use", false], ["replace", true]]);

  const copy = resolveTeamImport(
    [{ name: "Smash Team", roster: ["Marco Verdi", "Paolo Gialli"], action: "copy", existingTeamId: "t2", copyName: "Smash Team B" }],
    existing
  );
  assert.deepEqual(copy.errors, []);
  assert.equal(copy.operations[0].type, "create");
  assert.equal(copy.operations[0].name, "Smash Team B");

  const skip = resolveTeamImport([{ name: "Smash Team", roster: ["A", "B"], action: "skip" }], existing);
  assert.deepEqual(skip, { errors: [], operations: [] });
});

test("errori: doppione senza scelta, copia con nome già usato, nome cambiato nel frattempo", () => {
  assert.match(resolveTeamImport([{ name: "Smash Team", roster: ["A", "B"], action: "create" }], existing).errors[0], /esiste già/);
  assert.match(
    resolveTeamImport([{ name: "Smash Team", roster: ["A", "B"], action: "copy", existingTeamId: "t2", copyName: "padel lions" }], existing).errors[0],
    /già usato/
  );
  assert.match(
    resolveTeamImport([{ name: "Smash Team", roster: ["A", "B"], action: "use", existingTeamId: "altro" }], existing).errors[0],
    /ricarica/
  );
  assert.match(
    resolveTeamImport(
      [
        { name: "Nuova", roster: ["A", "B"], action: "create" },
        { name: "Smash Team", roster: ["A", "B"], action: "copy", existingTeamId: "t2", copyName: "Nuova" },
      ],
      existing
    ).errors.join(" "),
    /già usato|due squadre/
  );
});

test("squadra non compatibile con la categoria: solo copia", () => {
  const teams = [{ id: "t9", name: "Solo Serie C", roster: ["A", "B"], compatibleTypeIds: ["serie-c"] }];
  const plan = planTeamImport([{ name: "Solo Serie C", roster: ["A", "B"] }], teams, { typeId: "serie-a" });
  assert.equal(plan[0].compatible, false);
  assert.equal(plan[0].suggested, null);
  assert.match(resolveTeamImport([{ name: "Solo Serie C", roster: ["A", "B"], action: "use", existingTeamId: "t9" }], teams, { typeId: "serie-a" }).errors[0], /compatibile/);
});

test("il nome proposto per la copia è libero", () => {
  assert.equal(suggestCopyName("Smash Team", ["Smash Team", "Smash Team (2)"]), "Smash Team (3)");
});
