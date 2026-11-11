import type { Match, SetScore } from "../types";
import { evaluateSets, formatSets } from "./standingsEngine";

/** Set in compilazione: "" finché il valore non è scelto. */
export interface DraftSet {
  team1: number | "";
  team2: number | "";
}

export type DraftEvaluation =
  | { state: "empty" }
  | { state: "incomplete" }
  | { state: "invalid"; error: string }
  | { state: "valid"; sets: SetScore[]; result: NonNullable<Match["result"]> };

export const EMPTY_SET: DraftSet = { team1: "", team2: "" };

export function draftFromSets(sets?: SetScore[]): DraftSet[] {
  return [0, 1, 2].map((i) => (sets?.[i] ? { ...sets[i] } : { ...EMPTY_SET }));
}

export const isFilled = (set: DraftSet) => set.team1 !== "" && set.team2 !== "";
export const isEmpty = (set: DraftSet) => set.team1 === "" && set.team2 === "";

/** true se dopo i primi due set la partita è 1-1 e serve il terzo. */
export function needsThirdSet(draft: DraftSet[]) {
  const [first, second] = draft;
  if (!isFilled(first) || !isFilled(second)) return false;
  return first.team1 > first.team2 !== second.team1 > second.team2;
}

export function evaluateDraft(draft: DraftSet[]): DraftEvaluation {
  if (draft.every(isEmpty)) return { state: "empty" };
  const [first, second, third] = draft;
  if (!isFilled(first) || !isFilled(second)) return { state: "incomplete" };
  const rows = needsThirdSet(draft) || !isEmpty(third) ? [first, second, third] : [first, second];
  if (!rows.every(isFilled)) return { state: "incomplete" };
  const sets = rows.map((set) => ({ team1: Number(set.team1), team2: Number(set.team2) }));
  const evaluated = evaluateSets(sets);
  if (!evaluated.ok) return { state: "invalid", error: evaluated.error };
  return { state: "valid", sets, result: evaluated.result };
}

/** "2-1 (6-1 4-6 6-2)" oppure solo "2-1" per i risultati salvati senza set. */
export function formatMatchScore(match: Pick<Match, "result" | "sets">): string {
  if (!match.result) return "";
  const sets = formatSets(match.sets);
  return sets ? `${match.result} (${sets})` : match.result;
}
