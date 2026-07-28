import assert from "node:assert/strict";
import test from "node:test";
import { resolveActiveMatchdayId } from "../src/lib/activeMatchday.ts";

const days = [
  { id: "d1", editionId: "e1", number: 1 },
  { id: "d2", editionId: "e1", number: 2 },
  { id: "d3", editionId: "e1", number: 3 },
];

test("la giornata attiva manuale viene usata quando non ci sono risultati", () => {
  const matches = [{ id: "m1", editionId: "e1", matchdayId: "d2", team1Id: "a", team2Id: "b", status: "da_giocare" as const }];
  assert.equal(resolveActiveMatchdayId("d2", days, matches), "d2");
});

test("sceglie la giornata piu alta con un risultato completato", () => {
  const matches = [
    { id: "m1", editionId: "e1", matchdayId: "d1", team1Id: "a", team2Id: "b", status: "conclusa" as const, result: "2-0" as const },
    { id: "m2", editionId: "e1", matchdayId: "d3", team1Id: "a", team2Id: "b", status: "conclusa" as const, result: "2-1" as const },
  ];
  assert.equal(resolveActiveMatchdayId(undefined, days, matches), "d3");
});

test("la giornata piu alta con un risultato prevale sulla selezione manuale", () => {
  const matches = [
    { id: "m1", editionId: "e1", matchdayId: "d1", team1Id: "a", team2Id: "b", status: "conclusa" as const, result: "2-0" as const },
    { id: "m2", editionId: "e1", matchdayId: "d3", team1Id: "a", team2Id: "b", status: "conclusa" as const, result: "2-1" as const },
  ];
  assert.equal(resolveActiveMatchdayId("d1", days, matches), "d3");
});

test("ignora giornate nascoste, eliminate e senza partite", () => {
  const filteredDays = [
    { ...days[0], isHidden: true },
    { ...days[1], deletedAt: "2026-01-01" },
    days[2],
  ];
  const matches = [{ id: "m3", editionId: "e1", matchdayId: "d3", team1Id: "a", team2Id: "b", status: "da_giocare" as const }];
  assert.equal(resolveActiveMatchdayId("d1", filteredDays, matches), "d3");
});
