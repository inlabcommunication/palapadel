import test from "node:test";
import assert from "node:assert/strict";
import { groupHallOfFameRows } from "../src/lib/hallOfFame.ts";
import type { ChampionshipType, HistoricalWin } from "../src/types";

const types: ChampionshipType[] = [
  { id: "b", name: "Serie B", hasTeams: true, badgeColor: "serie-b", disabled: false },
  { id: "c", name: "Serie C", hasTeams: true, badgeColor: "serie-c", disabled: false },
];

test("l'Albo ordina per medaglie e conserva tutte le categorie della squadra", () => {
  const wins: HistoricalWin[] = [
    { id: "1", typeId: "b", teamId: "alpha", season: "2025/2026" },
    { id: "2", typeId: "c", teamId: "alpha", season: "2024/2025" },
    { id: "3", typeId: "c", teamId: "beta", season: "2025/2026" },
  ];
  const rows = groupHallOfFameRows(wins, types, (win) => win.teamId!, (win) => win.teamId!);

  assert.equal(rows[0].key, "alpha");
  assert.deepEqual(rows[0].wins.map((win) => win.typeId), ["b", "c"]);
});

test("a parita di medaglie l'Albo ordina alfabeticamente", () => {
  const wins: HistoricalWin[] = [
    { id: "1", typeId: "b", teamId: "zeta", season: "2025/2026" },
    { id: "2", typeId: "c", teamId: "alfa", season: "2025/2026" },
  ];
  const rows = groupHallOfFameRows(wins, types, (win) => win.teamId!, (win) => win.teamId!);

  assert.deepEqual(rows.map((row) => row.key), ["alfa", "zeta"]);
});
