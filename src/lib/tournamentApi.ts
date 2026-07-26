import { postToBackend } from "./backendClient";
import type { Tournament, TournamentBracketKey, TournamentBracketMode, TournamentStatus } from "../types";

const call = <T = { ok: true }>(body: object) => postToBackend<T>("/api/admin/tournament", body);
export const createTournament = (input: Pick<Tournament, "name" | "season" | "status" | "bracketMode" | "isPubliclyVisible">) =>
  call<{ ok: true; id: string }>({ operation: "createTournament", ...input });
export const updateTournament = (tournamentId: string, input: Pick<Tournament, "name" | "season" | "status" | "bracketMode" | "isPubliclyVisible">) =>
  call({ operation: "updateTournament", tournamentId, ...input });
export const deleteTournament = (tournamentId: string) => call({ operation: "deleteTournament", tournamentId });
export const createTournamentGroup = (tournamentId: string, name: string, order: number) =>
  call<{ ok: true; id: string }>({ operation: "createGroup", tournamentId, name, order });
export const updateTournamentGroup = (tournamentId: string, groupId: string, name: string, order: number) =>
  call({ operation: "updateGroup", tournamentId, groupId, name, order });
export const deleteTournamentGroup = (tournamentId: string, groupId: string) =>
  call({ operation: "deleteGroup", tournamentId, groupId });
export const addTournamentGroupTeam = (tournamentId: string, groupId: string, teamId: string, order: number) =>
  call({ operation: "addGroupTeam", tournamentId, groupId, teamId, order });
export const updateTournamentGroupTeam = (tournamentId: string, entryId: string, fields: { played: number; won: number; lost: number; points: number; order: number; qualified: boolean }) =>
  call({ operation: "updateGroupTeam", tournamentId, entryId, ...fields });
export const removeTournamentGroupTeam = (tournamentId: string, entryId: string) =>
  call({ operation: "removeGroupTeam", tournamentId, entryId });
export const createTournamentRound = (tournamentId: string, key: TournamentBracketKey, name: string, order: number) =>
  call<{ ok: true; id: string }>({ operation: "createRound", tournamentId, bracketKey: key, name, order });
export const updateTournamentRound = (tournamentId: string, roundId: string, name: string, order: number) =>
  call({ operation: "updateRound", tournamentId, roundId, name, order });
export const deleteTournamentRound = (tournamentId: string, roundId: string) =>
  call({ operation: "deleteRound", tournamentId, roundId });

export type TournamentMatchFields = {
  team1Id?: string | null;
  team2Id?: string | null;
  team1SourceMatchId?: string | null;
  team2SourceMatchId?: string | null;
  score?: string;
  winnerTeamId?: string | null;
};
export const createTournamentMatch = (tournamentId: string, key: TournamentBracketKey, roundId: string, order: number, fields: TournamentMatchFields) =>
  call<{ ok: true; id: string }>({ operation: "createMatch", tournamentId, bracketKey: key, roundId, order, ...fields });
export const updateTournamentMatch = (tournamentId: string, matchId: string, fields: TournamentMatchFields) =>
  call({ operation: "updateMatch", tournamentId, matchId, ...fields });
export const deleteTournamentMatch = (tournamentId: string, matchId: string) =>
  call({ operation: "deleteMatch", tournamentId, matchId });

export const tournamentStatusOptions: { value: TournamentStatus; label: string }[] = [
  { value: "bozza", label: "Bozza" },
  { value: "in_corso", label: "In corso" },
  { value: "concluso", label: "Concluso" },
];
export const tournamentBracketModeOptions: { value: TournamentBracketMode; label: string }[] = [
  { value: "unico", label: "Tabellone unico" },
  { value: "gold_silver", label: "Gold + Silver" },
];
