import { postToBackend } from "./backendClient";

/**
 * Fase 2 — servizio centralizzato per QUALUNQUE modifica strutturale alla classifica
 * squadre: aggiunta/modifica/rimozione voce, ricalcolo, cambio stato (ritirata/
 * squalificata/riattivata). Il frontend non usa più updateDoc/setDoc/deleteDoc/
 * writeBatch direttamente su editionTeams: tutto passa da qui, verso
 * api/standings/manage-entry.js, recalculate.js, set-status.js (Firebase Admin SDK).
 */

export interface AddEntryInput {
  editionId: string;
  teamId?: string;
  newTeam?: { name: string; roster: string[] };
}

export interface UpdateEntryInput {
  editionId: string;
  editionTeamId: string;
  baselinePoints: number;
  baselinePlayed: number;
  manualPointsAdjustment: number;
  manualPlayedAdjustment: number;
  order: number;
  operationalNotes?: string;
  reason: string;
}

export interface RemoveEntryInput {
  editionId: string;
  editionTeamId: string;
  reason: string;
}

export interface RecalculateInput {
  editionId: string;
  dryRun?: boolean;
}

export interface StandingsChange {
  teamId: string;
  fromPoints: number;
  toPoints: number;
  fromPlayed: number;
  toPlayed: number;
}

export interface SetTeamStatusInput {
  editionId: string;
  editionTeamId: string;
  newStatus: "ritirata" | "squalificata" | "normale";
  policy?: 1 | 2 | 3 | 4;
  reason: string;
}

export function addEntryToStandings(input: AddEntryInput) {
  return postToBackend<{ ok: true }>("/api/standings/manage-entry", { op: "add", ...input });
}

export function addEntriesToStandings(input: { editionId: string; teamIds: string[] }) {
  return postToBackend<{ ok: true; added: number }>("/api/standings/manage-entry", {
    op: "addBulk",
    ...input,
  });
}

export function updateStandingsEntry(input: UpdateEntryInput) {
  return postToBackend<{ ok: true }>("/api/standings/manage-entry", { op: "update", ...input });
}

export function removeStandingsEntry(input: RemoveEntryInput) {
  return postToBackend<{ ok: true }>("/api/standings/manage-entry", { op: "remove", ...input });
}

/** dryRun: true per una sola anteprima (nessuna scrittura); il calcolo è sempre server-side. */
export function recalculateStandings(input: RecalculateInput) {
  return postToBackend<{ ok: true; preview?: StandingsChange[]; applied?: StandingsChange[] }>(
    "/api/standings/recalculate",
    input
  );
}

export function setTeamStatus(input: SetTeamStatusInput) {
  return postToBackend<{ ok: true }>("/api/standings/set-status", input);
}
