export type Role = "superadmin" | "admin" | "gestore";

export type EditionStatus = "bozza" | "attiva" | "conclusa" | "nascosta";
export type ParticipationStatus = "normale" | "ritirata" | "squalificata";
export type MatchStatus = "da_giocare" | "conclusa" | "rinviata" | "annullata";
export type ContentStatus = "bozza" | "pubblicato";

/** users/{uid} — il ruolo vive qui, non nei custom claims (piano Spark = niente Cloud Functions) */
export interface AppUser {
  uid: string;
  username: string;
  role: Role;
  createdAt: string;
  /** Fase 2 — se true, il backend rifiuta qualunque operazione richiesta da questo utente. */
  disabled?: boolean;
}

/** championshipTypes/{id} */
export interface ChampionshipType {
  id: string;
  name: string;
  hasTeams: boolean;
  badgeColor: "serie-b" | "serie-c" | "principianti" | "femminile" | string;
}

/** championshipEditions/{id} */
export interface ChampionshipEdition {
  id: string;
  typeId: string;
  season: string; // formato libero: "2025/2026", "2026", ecc.
  status: EditionStatus;
  bestPlayerEnabled?: boolean;
  bracketEnabled?: boolean;
  createdAt?: string; // usato per ordinare le edizioni dello stesso tipo dalla più recente
  /**
   * Storico congelato: valorizzato automaticamente quando l'edizione passa a "conclusa"
   * (vedi src/lib/freezeEdition.ts). Da quel momento la vista pubblica e quella di default
   * per l'admin mostrano questi dati invece di ricalcolarli dal vivo, così una squadra
   * rinominata o eliminata in futuro non altera la classifica/il tabellone di quell'anno.
   * L'amministratore può comunque correggere i dati live e poi rilanciare il congelamento.
   */
  closedAt?: string;
  frozenStandings?: FrozenStandingRow[];
  frozenBracket?: FrozenBracketRound[];
  winnerId?: string;
  winnerName?: string;
}

/** Riga di classifica congelata al momento della conclusione dell'edizione. */
export interface FrozenStandingRow {
  id: string; // teamId (a squadre) o id del/la partecipante (femminile)
  name: string; // nome al momento del congelamento
  points: number;
  played?: number; // PG, solo campionati a squadre
  stages?: number; // Tappe, solo femminile
  status: ParticipationStatus;
}

export interface FrozenBracketMatch {
  team1Name?: string;
  team2Name?: string;
  score?: string;
  winnerName?: string;
  winnerSide?: 1 | 2; // evita ambiguità se due squadre avessero lo stesso nome
}

export interface FrozenBracketRound {
  name: string;
  order: number;
  matches: FrozenBracketMatch[];
}

/** teams/{id} — identità della squadra, indipendente dalle edizioni */
export interface Team {
  id: string;
  name: string;
  /** Foto di gruppo della squadra (non un logo/avatar individuale). Formato 16:9 o 3:2. */
  teamPhotoUrl?: string;
  roster: string[]; // 2-6 nomi
}

/**
 * editionTeams/{id} — partecipazione di una squadra a una specifica edizione.
 *
 * Modello "baseline + partite + correzione manuale" (vedi src/lib/recalcStandingsFromMatches.ts):
 * - baselinePoints/baselinePlayed: situazione al momento dell'importazione o dell'inserimento
 *   iniziale manuale. Non vengono mai toccati dal ricalcolo delle partite.
 * - matchPoints/matchPlayed: derivano ESCLUSIVAMENTE dalle partite "conclusa" della raccolta
 *   matches, tramite getStandingPointsFromResult (src/lib/standingsEngine.ts). Vengono
 *   ricalcolati da zero a ogni recalcStandingsFromMatches, mai sommati incrementalmente.
 * - manualPointsAdjustment/manualPlayedAdjustment: correzioni/penalizzazioni manuali, sempre
 *   preservate sia da un nuovo import sia da un nuovo ricalcolo partite.
 * - points/played: campi finali mostrati ovunque nell'app = baseline + match + correzione
 *   manuale. Sono l'unica fonte letta dai componenti di visualizzazione (classifica,
 *   congelamento edizione, ecc.).
 */
export interface EditionTeam {
  id: string;
  editionId: string;
  teamId: string;
<<<<<<< HEAD
  points: number; // finale mostrato ovunque = baselinePoints + matchPoints + manualPointsAdjustment
  played: number; // finale mostrato ovunque = baselinePlayed + matchPlayed + manualPlayedAdjustment
  order: number; // per spareggi manuali a pari punti
  status: ParticipationStatus;
  baselinePoints?: number;
  baselinePlayed?: number;
  matchPoints?: number;
  matchPlayed?: number;
  manualPointsAdjustment?: number;
  manualPlayedAdjustment?: number;
  /** Fase 15 — versione del modello dati applicata a questo documento dalla migrazione. */
  dataModelVersion?: number;
  migratedAt?: string;
  /**
   * @deprecated Sostituito da baselinePoints. Mantenuto solo per compatibilità in lettura
   * con documenti creati da versioni precedenti; src/lib/recalcStandingsFromMatches.ts lo
   * usa come fallback di migrazione quando baselinePoints non esiste ancora, poi non lo
   * scrive più.
   */
  calculatedPoints?: number;
=======
  points: number; // finale mostrato ovunque = calculatedPoints + manualPointsAdjustment
  played: number;
  order: number; // per spareggi manuali a pari punti
  status: ParticipationStatus;
  /**
   * Punti "grezzi" dall'ultimo inserimento manuale o import Excel. Un nuovo import
   * sovrascrive solo questo campo, mai manualPointsAdjustment, così una penalità o
   * correzione manuale non va persa quando arriva una nuova importazione.
   */
  calculatedPoints?: number;
  manualPointsAdjustment?: number;
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
}

/** femaleParticipants/{id} — campionato femminile, individuale */
export interface FemaleParticipant {
  id: string;
  editionId: string;
  name: string;
  points: number; // finale mostrato ovunque = calculatedPoints + manualPointsAdjustment
  stages: number;
  status: ParticipationStatus;
  calculatedPoints?: number;
  manualPointsAdjustment?: number;
<<<<<<< HEAD
  /** Fase 12 — ordine manuale o importato, usato come spareggio quando i punti coincidono. */
  order?: number;
=======
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
}

/** matchdays/{id} */
export interface Matchday {
  id: string;
  editionId: string;
  number: number;
}

/** matches/{id} */
export interface Match {
  id: string;
  matchdayId: string;
  editionId: string;
  team1Id: string;
  team2Id: string;
  result?: "2-0" | "2-1" | "1-2" | "0-2";
  status: MatchStatus;
<<<<<<< HEAD
  /** Fase 14 - stato reale dell'aggiornamento legato a questo risultato. */
  notificationStatus?: "none" | "draft" | "sent" | "failed";
  notificationDraftCreatedAt?: string;
  notificationSentAt?: string;
  notificationError?: string;
  notificationDraftId?: string;
  notificationNewsId?: string;
  /** Traccia chi ha salvato l'ultima modifica a risultato/stato e quando (audit log lato backend). */
  updatedAt?: string;
  updatedBy?: string;
=======
  /** Presente se per questo risultato è già stata creata una novità/notifica (vedi src/pages/Giornate.tsx). */
  notifiedAt?: string;
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
}

/**
 * bracketRounds/{id} — un turno del tabellone finale (es. "Ottavi", "Quarti", "Semifinale", "Finale").
 * La struttura è libera e decisa dall'amministratore ogni anno (punto 18 della specifica).
 */
export interface BracketRound {
  id: string;
  editionId: string;
  name: string;
  order: number;
}

/**
 * bracketMatches/{id} — un incontro del tabellone. team1Id/team2Id possono essere vuoti
 * (slot in attesa), l'avanzamento al turno successivo è sempre manuale.
 */
export interface BracketMatch {
  id: string;
  editionId: string;
  roundId: string;
  order: number;
  team1Id?: string;
  team2Id?: string;
  score?: string;
  winnerTeamId?: string;
}

/** homeNews/{id} */
export interface HomeNews {
  id: string;
  title: string;
  body: string;
  date: string;
  imageUrl?: string;
  category?: string;
  status: ContentStatus;
}

/**
 * historicalWins/{id} — vittorie storiche, sia precedenti alla creazione dell'app
 * (inserite a mano dal Super Amministratore) sia generate in futuro dalla
 * conclusione di un campionato gestito nell'app (Fase 4).
 * Per i campionati a squadre: teamId valorizzato. Per il Femminile: participantName valorizzato.
 */
export interface HistoricalWin {
  id: string;
  typeId: string;
  teamId?: string;
  participantName?: string;
  season: string;
  note?: string;
  /** Presente solo per le vittorie generate automaticamente dalla conclusione di un'edizione nell'app. */
  editionId?: string;
  /**
   * Nome della squadra/giocatrice al momento della vittoria: l'Albo d'oro deve mostrare
   * questo nome anche se la squadra viene rinominata o eliminata in seguito.
   */
  winnerNameSnapshot?: string;
}

/** auditLog/{id} */
export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  detail: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

export const BADGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "serie-b": { bg: "#E5E7EB", text: "#374151", label: "argento" },
  "serie-c": { bg: "#E7D3C2", text: "#7C4A26", label: "bronzo" },
  principianti: { bg: "#D8F0DB", text: "#1F6B34", label: "verde" },
  femminile: { bg: "#FBDCEC", text: "#9D1D63", label: "fucsia" },
};

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super amministratore",
  admin: "Amministratore",
  gestore: "Gestore risultati",
};
