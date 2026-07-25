import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChampionshipLogoFolder,
  getChampionshipLogoAlt,
  getChampionshipTypeInitials,
} from "../src/lib/championshipLogoPolicy.ts";

test("le iniziali placeholder sono fisse per le 4 categorie note e non collidono", () => {
  assert.equal(getChampionshipTypeInitials({ name: "Serie B", badgeColor: "serie-b" }), "SB");
  assert.equal(getChampionshipTypeInitials({ name: "Serie C", badgeColor: "serie-c" }), "SC");
  assert.equal(getChampionshipTypeInitials({ name: "Principianti", badgeColor: "principianti" }), "PR");
  assert.equal(getChampionshipTypeInitials({ name: "Femminile", badgeColor: "femminile" }), "FE");
  // Prima del fix, name.slice(0,2).toUpperCase() avrebbe dato "SE" per entrambe: verifichiamo
  // esplicitamente che restino diverse, non solo che abbiano un valore.
  assert.notEqual(
    getChampionshipTypeInitials({ name: "Serie B", badgeColor: "serie-b" }),
    getChampionshipTypeInitials({ name: "Serie C", badgeColor: "serie-c" })
  );
});

test("una tipologia personalizzata senza badgeColor noto ricade sulle iniziali del nome", () => {
  assert.equal(getChampionshipTypeInitials({ name: "Under 18", badgeColor: "custom-under18" }), "UN");
  assert.equal(getChampionshipTypeInitials({ name: "", badgeColor: "custom" }), "CH");
});

test("l'alt text del logo usa quello esplicito se presente, altrimenti 'Logo <nome>'", () => {
  assert.equal(getChampionshipLogoAlt({ name: "Serie B" }, ""), "Logo Serie B");
  assert.equal(getChampionshipLogoAlt({ name: "Serie B" }, "Stemma ufficiale"), "Stemma ufficiale");
  assert.equal(getChampionshipLogoAlt({ name: "  " }, undefined), "Logo campionato");
});

test("il percorso Storage del logo campionato rispetta branding/championships/{id}/logo", () => {
  assert.equal(buildChampionshipLogoFolder("serie-b"), "branding/championships/serie-b/logo");
});
