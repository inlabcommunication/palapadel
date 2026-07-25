import { postToBackend, BackendApiError } from "./backendClient";

/**
 * Servizio centralizzato per il flusso RISULTATO -> SALVATAGGIO PARTITA -> RICALCOLO
 * CLASSIFICA -> AUDIT LOG, più le operazioni strutturali su una partita (creazione ed
 * eliminazione, Fase 9). Nessun componente deve più chiamare fetch() direttamente o
 * scrivere su Firestore per queste operazioni: tutto passa da qui, verso
 * api/matches/*.js (Firebase Admin SDK, transazione atomica).
 */

// Alias per compatibilità con il codice esistente che importa MatchApiError.
export const MatchApiError = BackendApiError;
export type MatchApiError = BackendApiError;

export interface SaveMatchResultInput {
  matchId: string;
  result: "2-0" | "2-1" | "1-2" | "0-2";
}

export interface SetMatchStatusInput {
  matchId: string;
  status: "rinviata" | "annullata" | "da_giocare";
}

export type ApiMatchStatus = "scheduled" | "completed" | "postponed" | "cancelled";

export interface BulkEntry {
  matchId: string;
  result: "2-0" | "2-1" | "1-2" | "0-2" | null;
  status: ApiMatchStatus;
}

export interface SaveMatchdayBulkInput {
  matchdayId: string;
  editionId: string;
  entries: BulkEntry[];
}

export interface CreateMatchInput {
  editionId: string;
  matchdayId: string;
  team1Id: string;
  team2Id: string;
}

export interface DeleteMatchInput {
  matchId: string;
}

export interface UpdateMatchInput {
  matchId: string;
  matchdayId?: string;
  team1Id?: string;
  team2Id?: string;
}

/**
 * Salva (o corregge) il risultato di una singola partita. Conclude sempre la partita
 * (status diventa "conclusa"), ricalcola la classifica dell'edizione e registra l'audit
 * log, tutto nella stessa operazione atomica lato server. Ritorna solo dopo che TUTTO è
 * stato salvato: se la promise si risolve, il salvataggio è reale su Firestore.
 */
export function saveMatchResult(input: SaveMatchResultInput) {
  return postToBackend<{ ok: true }>("/api/matches/save-result", input);
}

/**
 * Cambia lo stato di una partita (rinviata/annullata/riapertura a da_giocare), rimuovendo
 * un eventuale risultato attivo e ricalcolando la classifica. Stessa atomicità di
 * saveMatchResult, stesso endpoint.
 */
export function setMatchStatus(input: SetMatchStatusInput) {
  return postToBackend<{ ok: true }>("/api/matches/save-result", input);
}

/**
 * Salva in un colpo solo tutti i risultati di una giornata. Se anche una sola voce non
 * è valida, il backend non salva nulla e restituisce l'elenco degli errori in
 * BackendApiError.details.
 */
export function saveMatchdayBulk(input: SaveMatchdayBulkInput) {
  return postToBackend<{ ok: true; saved: number }>("/api/matches/save-bulk", input);
}

/**
 * Fase 9 — crea una partita. Tutte le validazioni (squadre diverse, entrambe iscritte
 * all'edizione, nessuna già impegnata nella giornata, partita non duplicata anche con
 * squadre invertite) avvengono lato backend, non solo nel frontend.
 */
export function createMatch(input: CreateMatchInput) {
  return postToBackend<{ ok: true; matchId: string }>("/api/matches/create-match", input);
}

/** Fase 5 — modifica squadre/giornata di una partita con validazioni atomiche lato backend. */
export function updateMatch(input: UpdateMatchInput) {
  return postToBackend<{ ok: true }>("/api/matches/update-match", input);
}

export interface CreateHomeNewsUpdateInput {
  matchIds: string[];
  editionId: string;
  matchdayId: string;
  typeName: string;
  season: string;
}

/** Fase 9 — elimina una partita e ricalcola la classifica nella stessa transazione. */
export function deleteMatch(input: DeleteMatchInput) {
  return postToBackend<{ ok: true }>("/api/matches/delete-match", input);
}

/**
 * Fase 6 — crea la bozza di aggiornamento Home dopo uno o più risultati conclusi, come
 * unica operazione atomica lato backend (partita/e + notizia + audit log). Il frontend
 * non scrive mai più direttamente su homeNews o sui campi di notifica delle partite.
 */
export function createHomeNewsUpdate(input: CreateHomeNewsUpdateInput) {
  return postToBackend<{ ok: true; newsId: string }>("/api/home-news/create-result-update", input);
}
