import type { ChampionshipEdition, ChampionshipType } from "../types";

export function sortChampionshipTypes(types: ChampionshipType[]) {
  return [...types].sort(
    (a, b) =>
      (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name, "it")
  );
}

export function sortEditionsByTypeOrder(editions: ChampionshipEdition[], types: ChampionshipType[]) {
  const typeOrder = new Map(sortChampionshipTypes(types).map((type, index) => [type.id, index]));
  return [...editions].sort(
    (a, b) =>
      (typeOrder.get(a.typeId) ?? Number.MAX_SAFE_INTEGER) -
        (typeOrder.get(b.typeId) ?? Number.MAX_SAFE_INTEGER) ||
      (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
  );
}
