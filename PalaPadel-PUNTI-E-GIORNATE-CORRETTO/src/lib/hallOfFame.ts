import type { ChampionshipType, HistoricalWin } from "../types";

export type HallOfFameRow = {
  key: string;
  label: string;
  wins: Array<HistoricalWin & { type?: ChampionshipType }>;
};

export function groupHallOfFameRows(
  sourceWins: HistoricalWin[],
  types: ChampionshipType[],
  getKey: (win: HistoricalWin) => string,
  getLabel: (win: HistoricalWin) => string
): HallOfFameRow[] {
  const grouped = new Map<string, HallOfFameRow>();
  sourceWins.forEach((win) => {
    const key = getKey(win);
    const entry = grouped.get(key) ?? { key, label: getLabel(win), wins: [] };
    entry.wins.push({ ...win, type: types.find((type) => type.id === win.typeId) });
    grouped.set(key, entry);
  });
  return [...grouped.values()].sort(
    (a, b) => b.wins.length - a.wins.length || a.label.localeCompare(b.label, "it")
  );
}
