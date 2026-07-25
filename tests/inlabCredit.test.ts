import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INLAB_INSTAGRAM_URL, INLAB_LOGO_ALT, INLAB_LOGO_FOLDER } from "../src/lib/inlabLogoPolicy.ts";

test("il link InLab punta esattamente al profilo Instagram richiesto", () => {
  assert.equal(INLAB_INSTAGRAM_URL, "https://www.instagram.com/inlab.communication/");
});

test("l'alt text del logo InLab e il percorso Storage sono quelli richiesti", () => {
  assert.equal(INLAB_LOGO_ALT, "Logo InLab");
  assert.equal(INLAB_LOGO_FOLDER, "branding/inlab/logo");
});

/**
 * Guardia di regressione: i generatori di immagini condivisibili (classifica,
 * giornata) disegnano tutto da zero su <canvas> e non devono MAI importare
 * InLabCredit o il layout della pagina, altrimenti il footer rischierebbe di
 * finire dentro le immagini esportate. Un controllo statico sul sorgente basta
 * a intercettare una futura regressione senza bisogno di renderizzare i canvas.
 */
test("i generatori di immagini condivisibili non importano il footer InLab", () => {
  for (const path of ["../src/lib/standingsShareImage.ts", "../src/lib/matchdayShareImage.ts"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /InLabCredit/);
    assert.doesNotMatch(source, /Web app creata da InLab/);
  }
});
