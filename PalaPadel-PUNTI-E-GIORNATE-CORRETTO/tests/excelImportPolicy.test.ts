import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ADMIN_IMPORT_BYTES, validateAdminImportFile } from "../src/lib/excelImportPolicy.js";

test("accetta un file Excel amministrativo valido entro 5 MB", () => {
  assert.equal(validateAdminImportFile({ name: "squadre.xlsx", size: 1024 }, ["xlsx", "xls"]), null);
});

test("rifiuta file vuoti, troppo grandi o con estensione diversa", () => {
  assert.match(validateAdminImportFile({ name: "squadre.xlsx", size: 0 }, ["xlsx"]) ?? "", /vuoto/);
  assert.match(validateAdminImportFile({ name: "squadre.xlsx", size: MAX_ADMIN_IMPORT_BYTES + 1 }, ["xlsx"]) ?? "", /5 MB/);
  assert.match(validateAdminImportFile({ name: "squadre.pdf", size: 1024 }, ["xlsx"]) ?? "", /Formato/);
});
