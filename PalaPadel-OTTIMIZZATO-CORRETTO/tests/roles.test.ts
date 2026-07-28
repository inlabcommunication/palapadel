import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRole as normalizeClientRole } from "../src/types/index.ts";
import { normalizeRole as normalizeServerRole, roleAllowed } from "../server/_lib/roles.js";

test("frontend e backend normalizzano i ruoli legacy nei ruoli definitivi", () => {
  assert.equal(normalizeClientRole("superadmin"), "superAdmin");
  assert.equal(normalizeClientRole("gestore"), "resultManager");
  assert.equal(normalizeServerRole("superadmin"), "superAdmin");
  assert.equal(normalizeServerRole("gestore"), "resultManager");
});

test("un admin non supera un controllo riservato al superAdmin", () => {
  assert.equal(roleAllowed("admin", ["superAdmin"]), false);
  assert.equal(roleAllowed("superAdmin", ["superAdmin"]), true);
  assert.equal(roleAllowed("superadmin", ["superAdmin"]), true);
});
