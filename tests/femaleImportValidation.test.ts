import { test } from "node:test";
import assert from "node:assert/strict";
import { findSimilarByName, normalizeParticipationStatus, similarityLevel } from "../api/standings/import.js";

test("l'import Femminile segnala nomi molto simili con un livello di somiglianza", () => {
  const match = findSimilarByName("Francesca Bocardi", [{ id: "p1", name: "Francesca Boccardi" }]);
  assert.equal(match?.candidate.id, "p1");
  assert.ok(match && match.similarity >= 0.82);
});

test("la similarita normalizza accenti, maiuscole e spazi doppi", () => {
  assert.equal(similarityLevel("Gabriella  Schino", "gabrièlla schino"), 1);
});

test("lo stato importato del Femminile viene normalizzato prima del salvataggio", () => {
  assert.equal(normalizeParticipationStatus("Attiva"), "normale");
  assert.equal(normalizeParticipationStatus("ritirata"), "ritirata");
  assert.equal(normalizeParticipationStatus("SQUALIFICATA"), "squalificata");
  assert.equal(normalizeParticipationStatus("non valido"), null);
});
