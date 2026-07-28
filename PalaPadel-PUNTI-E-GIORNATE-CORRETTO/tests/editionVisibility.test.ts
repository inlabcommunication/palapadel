import test from "node:test";
import assert from "node:assert/strict";
import { resolveEditionVisibility } from "../server/admin/championship.js";

test("un'edizione che passa da bozza ad attiva diventa visibile", () => {
  assert.equal(resolveEditionVisibility("bozza", false, "attiva"), true);
});

test("un'edizione che passa da nascosta ad attiva diventa visibile", () => {
  assert.equal(resolveEditionVisibility("nascosta", false, "attiva"), true);
});

test("un'edizione nascosta manualmente resta nascosta durante una modifica ordinaria", () => {
  assert.equal(resolveEditionVisibility("attiva", false, "attiva"), false);
});

test("bozza e nascosta non restano pubbliche", () => {
  assert.equal(resolveEditionVisibility("attiva", true, "bozza"), false);
  assert.equal(resolveEditionVisibility("attiva", true, "nascosta"), false);
});
