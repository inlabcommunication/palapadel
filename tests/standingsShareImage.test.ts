import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStandingsShareFilename,
  paginateStandingRows,
  sanitizeFilenamePart,
  STANDINGS_SHARE_MAX_ROWS_PER_IMAGE,
  STANDINGS_SHARE_HEIGHT,
  STANDINGS_SHARE_WIDTH,
  type StandingsShareInput,
} from "../src/lib/standingsShareImage.ts";

test("le immagini classifica usano il formato verticale 1080x1920", () => {
  assert.equal(STANDINGS_SHARE_WIDTH, 1080);
  assert.equal(STANDINGS_SHARE_HEIGHT, 1920);
});

test("paginateStandingRows non perde righe e crea piu immagini quando la classifica e lunga", () => {
  const rows = Array.from({ length: STANDINGS_SHARE_MAX_ROWS_PER_IMAGE * 2 + 3 }, (_, index) => index + 1);
  const pages = paginateStandingRows(rows);

  assert.equal(pages.length, 3);
  assert.deepEqual(pages.flat(), rows);
});

test("paginateStandingRows mantiene una pagina anche per una classifica vuota", () => {
  assert.deepEqual(paginateStandingRows([]), [[]]);
});

test("buildStandingsShareFilename normalizza categoria, stagione e suffisso pagina", () => {
  const input: StandingsShareInput = {
    categoryName: "Serie C - Principianti",
    season: "2025/2026",
    kind: "team",
    rows: [],
  };

  assert.equal(sanitizeFilenamePart("Femminile elite"), "femminile-elite");
  assert.equal(buildStandingsShareFilename(input), "palapadel-classifica-serie-c-principianti-2025-2026.png");
  assert.equal(buildStandingsShareFilename(input, 2, 3), "palapadel-classifica-serie-c-principianti-2025-2026-pagina-2.png");
});
