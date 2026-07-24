import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type {
  BracketMatch,
  BracketRound,
  ChampionshipEdition,
  ChampionshipType,
  EditionTeam,
  FemaleParticipant,
  FrozenBracketRound,
  FrozenStandingRow,
  Team,
} from "../types";

/**
 * Congela lo storico di un'edizione: fotografa classifica finale, partecipanti,
 * tabellone e vincitore con i nomi di quel momento, e crea/aggiorna la voce
 * corrispondente nell'Albo d'oro con winnerNameSnapshot. Da qui in avanti, rinominare
 * o eliminare una squadra non altera più come appare questa edizione nello Storico.
 *
 * Richiamabile più volte (es. pulsante "Ricongela" dopo una correzione ai dati):
 * sovrascrive lo snapshot precedente ma non duplica la voce nell'Albo d'oro,
 * perché la cerca tramite editionId prima di crearne una nuova.
 */
export async function freezeEdition(edition: ChampionshipEdition, type: ChampionshipType) {
  let frozenStandings: FrozenStandingRow[] = [];
  let winnerId: string | undefined;
  let winnerName: string | undefined;

  if (type.hasTeams) {
    const [editionTeamsSnap, teamsSnap] = await Promise.all([
      getDocs(query(collection(db, "editionTeams"), where("editionId", "==", edition.id))),
      getDocs(collection(db, "teams")),
    ]);
    const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
    const rows = editionTeamsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as EditionTeam)
      .map((et) => ({ et, team: teams.find((t) => t.id === et.teamId) }))
      .sort((a, b) => {
        const aOut = a.et.status !== "normale";
        const bOut = b.et.status !== "normale";
        if (aOut !== bOut) return aOut ? 1 : -1;
        if (b.et.points !== a.et.points) return b.et.points - a.et.points;
        return a.et.order - b.et.order;
      });
    frozenStandings = rows.map(({ et, team }) => ({
      id: et.teamId,
      name: team?.name ?? "Squadra eliminata",
      points: et.points,
      played: et.played,
      status: et.status,
    }));
    const winnerRow = rows.find((r) => r.et.status === "normale");
    if (winnerRow) {
      winnerId = winnerRow.et.teamId;
      winnerName = winnerRow.team?.name ?? "Squadra eliminata";
    }
  } else {
    const participantsSnap = await getDocs(
      query(collection(db, "femaleParticipants"), where("editionId", "==", edition.id))
    );
    const rows = participantsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as FemaleParticipant)
      .sort((a, b) => {
        const aOut = a.status !== "normale";
        const bOut = b.status !== "normale";
        if (aOut !== bOut) return aOut ? 1 : -1;
        return b.points - a.points;
      });
    frozenStandings = rows.map((r) => ({
      id: r.id,
      name: r.name,
      points: r.points,
      stages: r.stages,
      status: r.status,
    }));
    const winnerRow = rows.find((r) => r.status === "normale");
    if (winnerRow) {
      winnerId = winnerRow.id;
      winnerName = winnerRow.name;
    }
  }

  let frozenBracket: FrozenBracketRound[] | undefined;
  if (edition.bracketEnabled) {
    const [roundsSnap, matchesSnap, teamsSnap] = await Promise.all([
      getDocs(query(collection(db, "bracketRounds"), where("editionId", "==", edition.id))),
      getDocs(query(collection(db, "bracketMatches"), where("editionId", "==", edition.id))),
      getDocs(collection(db, "teams")),
    ]);
    const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
    const teamName = (id?: string) => (id ? teams.find((t) => t.id === id)?.name ?? "Squadra eliminata" : undefined);
    const rounds = roundsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as BracketRound)
      .sort((a, b) => a.order - b.order);
    const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketMatch);

    frozenBracket = rounds.map((r) => ({
      name: r.name,
      order: r.order,
      matches: matches
        .filter((m) => m.roundId === r.id)
        .sort((a, b) => a.order - b.order)
        .map((m) => ({
          team1Name: teamName(m.team1Id),
          team2Name: teamName(m.team2Id),
          score: m.score,
          winnerName: teamName(m.winnerTeamId),
          winnerSide: m.winnerTeamId ? (m.winnerTeamId === m.team1Id ? 1 : m.winnerTeamId === m.team2Id ? 2 : undefined) : undefined,
        })),
    }));

    // Se l'ultimo turno del tabellone ha un vincitore deciso, prevale sulla classifica
    // a gironi come vero campione dell'edizione (formati con playoff finale).
    const finalRound = [...rounds].sort((a, b) => b.order - a.order)[0];
    if (finalRound) {
      const finalMatch = matches.find((m) => m.roundId === finalRound.id && m.winnerTeamId);
      if (finalMatch?.winnerTeamId) {
        winnerId = finalMatch.winnerTeamId;
        winnerName = teamName(finalMatch.winnerTeamId);
      }
    }
  }

  await updateDoc(doc(db, "championshipEditions", edition.id), {
    closedAt: new Date().toISOString(),
    frozenStandings,
    ...(frozenBracket ? { frozenBracket } : {}),
    ...(winnerId ? { winnerId } : {}),
    ...(winnerName ? { winnerName } : {}),
  });

  if (winnerName) {
    const existingWinSnap = await getDocs(
      query(collection(db, "historicalWins"), where("editionId", "==", edition.id))
    );
    if (existingWinSnap.empty) {
      await addDoc(collection(db, "historicalWins"), {
        typeId: edition.typeId,
        editionId: edition.id,
        ...(type.hasTeams ? { teamId: winnerId } : { participantName: winnerName }),
        winnerNameSnapshot: winnerName,
        season: edition.season,
      });
    } else {
      await updateDoc(doc(db, "historicalWins", existingWinSnap.docs[0].id), {
        ...(type.hasTeams ? { teamId: winnerId } : { participantName: winnerName }),
        winnerNameSnapshot: winnerName,
      });
    }
  }

  return { frozenStandings, frozenBracket, winnerName };
}
