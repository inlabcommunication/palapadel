import assert from "node:assert/strict";
import test from "node:test";
import {
  documentId,
  notificationEventSchema,
  notificationTopicsSchema,
  parseBody,
  z,
} from "../server/_lib/validation.js";

test("parseBody accetta un payload valido e rimuove spazi secondo lo schema", () => {
  const result = parseBody(z.object({ editionId: documentId }).strict(), { editionId: " ed-1 " });
  assert.equal(result.editionId, "ed-1");
});

test("parseBody rifiuta campi sconosciuti con VALIDATION_ERROR", () => {
  assert.throws(
    () => parseBody(z.object({ editionId: documentId }).strict(), { editionId: "ed-1", role: "superAdmin" }),
    (error: unknown) => {
      const value = error as { details?: { code?: string; fields?: Record<string, string> } };
      assert.equal(value.details?.code, "VALIDATION_ERROR");
      assert.ok(value.details?.fields);
      return true;
    }
  );
});

test("lo schema notifiche rifiuta URL e testo oltre i limiti", () => {
  const parsed = notificationEventSchema.safeParse({
    type: "news",
    title: "Titolo",
    body: "x".repeat(221),
    url: "/news",
  });
  assert.equal(parsed.success, false);
});

test("le preferenze notifiche rifiutano argomenti estranei", () => {
  const parsed = notificationTopicsSchema.safeParse({ news: true, secret: true });
  assert.equal(parsed.success, false);
});
