import type { Match } from "../types";
import { getStandingPointsFromResult as getSharedStandingPointsFromResult } from "../../shared/standingPoints.js";

/**
 * Punti classifica associati a ciascuno dei 4 risultati ammessi. Questa è l'UNICA
 * fonte autorevole per la conversione risultato -> punti: nessun altro punto del
 * codice deve derivare i punti dalle cifre del risultato (es. "2-0".split("-")),
 * perché quelle cifre sono il punteggio dell'incontro (set/gare vinte), non i
 * punti in classifica.
 *
 * Regole:
 * 2-0 -> 3 punti alla squadra1, 0 alla squadra2
 * 2-1 -> 2 punti alla squadra1, 1 alla squadra2
 * 1-2 -> 1 punto alla squadra1, 2 alla squadra2
 * 0-2 -> 0 punti alla squadra1, 3 alla squadra2
 */
export interface StandingPoints {
  team1: number;
  team2: number;
}

export interface StandingRow {
  status: string;
  points: number;
  order?: number;
}

/**
 * Fase 12 — ordinamento unico per classifica squadre e Femminile: stato "normale"
 * prima di ritirata/squalificata, poi punti decrescenti, poi ordine manuale/importato
 * per i pari punti (mai un ordine fisso a 0 per tutti). Funzione pura e condivisa così
 * il comportamento resta identico nei due modelli e testabile senza montare React.
 */
export function compareStandingRows<T extends StandingRow>(a: T, b: T): number {
  const aOut = a.status !== "normale";
  const bOut = b.status !== "normale";
  if (aOut !== bOut) return aOut ? 1 : -1;
  if (b.points !== a.points) return b.points - a.points;
  return (a.order ?? 0) - (b.order ?? 0);
}

/**
 * Restituisce i punti classifica per un risultato, oppure null se il risultato
 * non è uno dei quattro ammessi (o è assente). Va sempre usata al posto di
 * leggere direttamente le cifre della stringa result.
 */
export function getStandingPointsFromResult(result: string | undefined | null): StandingPoints | null {
  const points = getSharedStandingPointsFromResult(result);
  return points ? { team1: points.team1, team2: points.team2 } : null;
}

/**
 * Una partita assegna punti in classifica soltanto se è "conclusa" (completed) e ha
 * un risultato tra quelli ammessi. Le partite "da_giocare", "rinviata" e "annullata"
 * non assegnano mai punti né partite giocate, indipendentemente da eventuali dati
 * residui nel documento.
 */
export function matchContributesToStandings(match: Pick<Match, "status" | "result">): boolean {
  return match.status === "conclusa" && getStandingPointsFromResult(match.result) !== null;
}

export interface TeamMatchTotals {
  points: number;
  played: number;
}

/**
 * Calcola, per ogni teamId, il totale di punti/partite giocate derivante ESCLUSIVAMENTE
 * dalle partite fornite (tipicamente tutte le partite "conclusa" di un'edizione).
 * Funzione pura, senza accesso a Firestore: usata sia dal ricalcolo autorevole
 * (src/lib/recalcStandingsFromMatches.ts) sia dai test automatici (Fase 16).
 * Ricalcola sempre da zero: non va mai usata per sommare un singolo nuovo risultato
 * a un totale già esistente, altrimenti una correzione rischia il doppio conteggio.
 */
export function computeMatchTotals(
  matches: Pick<Match, "team1Id" | "team2Id" | "status" | "result">[]
): Map<string, TeamMatchTotals> {
  const totals = new Map<string, TeamMatchTotals>();
  for (const m of matches) {
    if (!matchContributesToStandings(m)) continue;
    const pts = getStandingPointsFromResult(m.result)!;
    const t1 = totals.get(m.team1Id) ?? { points: 0, played: 0 };
    t1.points += pts.team1;
    t1.played += 1;
    totals.set(m.team1Id, t1);
    const t2 = totals.get(m.team2Id) ?? { points: 0, played: 0 };
    t2.points += pts.team2;
    t2.played += 1;
    totals.set(m.team2Id, t2);
  }
  return totals;
}
