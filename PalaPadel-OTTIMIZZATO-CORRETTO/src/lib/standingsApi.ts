import { postToBackend, BackendApiError } from "./backendClient";

export { BackendApiError as StandingsApiError };

export interface ImportStandingsRow {
  name: string;
  points: number;
  played: number;
  linkedTeamId?: string;
  createNewTeam?: boolean;
}

export interface ImportStandingsInput {
  editionId: string;
  mode: 1 | 2 | 3;
  mode2Choice?: "A" | "B";
  mode2ThresholdMatchdayNumber?: number;
  rows: ImportStandingsRow[];
}

export interface ImportFemaleRow {
  name: string;
  points: number;
  stages: number;
  status?: "normale" | "ritirata" | "squalificata";
  note?: string;
  linkedParticipantId?: string;
  createNew?: boolean;
}

export interface ImportFemaleInput {
  editionId: string;
  mode: 1 | 2 | 3;
  mode2AbsentPolicy?: "keep" | "retire" | "remove";
  rows: ImportFemaleRow[];
}

export interface UnresolvedImportRow {
  index: number;
  name: string;
  reason: string;
  similarTeamId?: string;
  similarTeamName?: string;
  similarParticipantId?: string;
  similarParticipantName?: string;
}

/**
 * Fase 10/11 (squadre) — importa la classifica a squadre in un'unica operazione
 * atomica lato backend (api/standings/import.js). Se una riga richiede una scelta
 * esplicita (nome simile a una squadra esistente, o nessuna corrispondenza), il
 * backend rifiuta l'INTERA importazione e restituisce l'elenco in
 * BackendApiError.details: nessuna riga viene salvata finché tutte non sono risolte.
 */
export function importStandings(input: ImportStandingsInput) {
  return postToBackend<{ ok: true; matchedCount: number; createdCount: number; warnings: string[] }>(
    "/api/standings/import",
    input
  );
}

/**
 * Fase 3 — importa la classifica Femminile in un'unica operazione atomica lato
 * backend (stesso endpoint, categoria individuale: nessun risultato di partita da
 * sommare). Stessa semantica "tutto o niente" dell'import a squadre.
 */
export function importFemaleStandings(input: ImportFemaleInput) {
  return postToBackend<{
    ok: true;
    matchedCount: number;
    createdCount: number;
    removedCount?: number;
    retiredCount?: number;
    warnings: string[];
  }>("/api/standings/import", input);
}
