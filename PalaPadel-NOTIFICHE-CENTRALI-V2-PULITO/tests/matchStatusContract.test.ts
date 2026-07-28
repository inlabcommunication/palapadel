import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMatchChange } from "../server/_lib/matchStatus.js";

test("save-bulk accetta il contratto richiesto con status completed e risultato", () => {
  assert.deepEqual(normalizeMatchChange({ result: "2-1", status: "completed" }), {
    ok: true,
    status: "conclusa",
    result: "2-1",
  });
});

test("save-bulk mappa scheduled/postponed/cancelled sui valori Firestore esistenti", () => {
  assert.deepEqual(normalizeMatchChange({ result: null, status: "scheduled" }), {
    ok: true,
    status: "da_giocare",
    result: null,
  });
  assert.deepEqual(normalizeMatchChange({ result: null, status: "postponed" }), {
    ok: true,
    status: "rinviata",
    result: null,
  });
  assert.deepEqual(normalizeMatchChange({ result: null, status: "cancelled" }), {
    ok: true,
    status: "annullata",
    result: null,
  });
});

test("save-bulk blocca una modifica invalida senza normalizzarla", () => {
  const normalized = normalizeMatchChange({ result: "2-0", status: "postponed" });
  assert.equal(normalized.ok, false);
});
