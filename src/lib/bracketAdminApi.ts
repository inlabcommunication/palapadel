import { postToBackend } from "./backendClient";

export type BracketMatchFields = { team1Id?: string | null; team2Id?: string | null; score?: string; winnerTeamId?: string | null };
const call = <T = { ok: true }>(body: object) => postToBackend<T>("/api/admin/bracket", body);

export const toggleBracket = (editionId: string, enabled: boolean) => call({ operation: "toggle", editionId, enabled });
export const createBracketRound = (editionId: string, name: string, order: number) => call<{ ok: true; id: string }>({ operation: "createRound", editionId, name, order });
export const moveBracketRound = (editionId: string, roundId: string, roundOrder: number, otherRoundId: string, otherOrder: number) => call({ operation: "moveRound", editionId, roundId, roundOrder, otherRoundId, otherOrder });
export const renameBracketRound = (editionId: string, roundId: string, name: string) => call({ operation: "renameRound", editionId, roundId, name });
export const deleteBracketRound = (editionId: string, roundId: string) => call({ operation: "deleteRound", editionId, roundId });
export const generateBracketRound = (editionId: string, roundId: string, matches: ({ order: number } & BracketMatchFields)[]) => call({ operation: "generateRound", editionId, roundId, matches });
export const createBracketMatch = (editionId: string, roundId: string, order: number, fields: BracketMatchFields) => call({ operation: "createMatch", editionId, roundId, order, ...fields });
export const updateBracketMatch = (editionId: string, matchId: string, fields: BracketMatchFields) => call({ operation: "updateMatch", editionId, matchId, ...fields });
export const deleteBracketMatch = (editionId: string, matchId: string) => call({ operation: "deleteMatch", editionId, matchId });
