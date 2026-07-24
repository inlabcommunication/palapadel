import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Match } from "../types";

/**
 * Ricalcola calculatedPoints e played di ogni squadra iscritta a un'edizione, sommando
 * i risultati di tutte le partite concluse (status "conclusa"). Il formato del risultato
 * ("2-0", "2-1", "1-2", "0-2") è già il punteggio: il primo numero sono i punti guadagnati
 * dalla squadra1 in quella partita, il secondo dalla squadra2 (punti = incontri vinti).
 *
 * Preserva sempre manualPointsAdjustment (vedi Punto 2, src/pages/Campionati.tsx):
 * points finale scritto = calculatedPoints appena ricalcolato + correzione manuale
 * esistente, che non viene mai toccata da qui.
 *
 * Va richiamata dopo ogni inserimento/modifica/eliminazione di un risultato o dopo un
 * cambio di stato partita (es. da "conclusa" a "rinviata"), perché ricalcola sempre da
 * zero leggendo tutte le partite concluse dell'edizione: più lento di un aggiornamento
 * incrementale, ma non rischia di andare fuori sincrono nel tempo.
 */
export async function recalcStandingsFromMatches(
  editionId: string,
  editionTeams: { id: string; teamId: string; manualPointsAdjustment?: number }[]
) {
  const matchesSnap = await getDocs(
    query(collection(db, "matches"), where("editionId", "==", editionId), where("status", "==", "conclusa"))
  );
  const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match);

  const totals = new Map<string, { points: number; played: number }>();
  for (const m of matches) {
    if (!m.result) continue;
    const [p1, p2] = m.result.split("-").map(Number);
    const t1 = totals.get(m.team1Id) ?? { points: 0, played: 0 };
    t1.points += p1;
    t1.played += 1;
    totals.set(m.team1Id, t1);
    const t2 = totals.get(m.team2Id) ?? { points: 0, played: 0 };
    t2.points += p2;
    t2.played += 1;
    totals.set(m.team2Id, t2);
  }

  for (const et of editionTeams) {
    const totalsForTeam = totals.get(et.teamId) ?? { points: 0, played: 0 };
    const adjustment = et.manualPointsAdjustment ?? 0;
    await updateDoc(doc(db, "editionTeams", et.id), {
      calculatedPoints: totalsForTeam.points,
      played: totalsForTeam.played,
      points: totalsForTeam.points + adjustment,
    });
  }
}
