import assert from "node:assert/strict";
import test from "node:test";
import { sortChampionshipTypes, sortEditionsByTypeOrder } from "../src/lib/championshipOrder.ts";
import type { ChampionshipEdition, ChampionshipType } from "../src/types/index.ts";

const types = [
  { id: "b", name: "Serie B", hasTeams: true, badgeColor: "serie-b", displayOrder: 1 },
  { id: "c", name: "Serie C", hasTeams: true, badgeColor: "serie-c", displayOrder: 0 },
  { id: "f", name: "Femminile", hasTeams: false, badgeColor: "femminile", displayOrder: 2 },
] satisfies ChampionshipType[];

test("l'ordine pubblico delle categorie rispetta displayOrder", () => {
  assert.deepEqual(sortChampionshipTypes(types).map((type) => type.id), ["c", "b", "f"]);
});

test("le edizioni pubbliche seguono prima l'ordine della categoria", () => {
  const editions = [
    { id: "ed-f", typeId: "f", season: "2026", status: "attiva" },
    { id: "ed-b", typeId: "b", season: "2026", status: "attiva" },
    { id: "ed-c", typeId: "c", season: "2026", status: "attiva" },
  ] satisfies ChampionshipEdition[];
  assert.deepEqual(sortEditionsByTypeOrder(editions, types).map((edition) => edition.id), ["ed-c", "ed-b", "ed-f"]);
});
