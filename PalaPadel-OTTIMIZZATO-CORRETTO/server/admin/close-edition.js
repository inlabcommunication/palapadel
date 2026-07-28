import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload, defaultNotificationSettings, resolveNotificationMode } from "../_lib/notifications.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { findBracketWinnerMatch } from "../../shared/bracketWinner.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { editionId } = parseBody(z.object({ editionId: documentId }).strict(), req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    let result = null;

    await db.runTransaction(async (transaction) => {
      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const editionSnap = await transaction.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      const edition = editionSnap.data();
      if (edition.status === "conclusa") throw new HttpError(409, "L'edizione è già conclusa");

      const typeSnap = await transaction.get(db.doc(`championshipTypes/${edition.typeId}`));
      if (!typeSnap.exists) throw new HttpError(400, "Tipologia del campionato non trovata");
      const type = typeSnap.data();
      let frozenStandings = [];
      let winnerId;
      let winnerName;

      if (type.hasTeams) {
        const [entriesSnap, teamsSnap] = await Promise.all([
          transaction.get(db.collection("editionTeams").where("editionId", "==", editionId)),
          transaction.get(db.collection("teams")),
        ]);
        const teams = new Map(teamsSnap.docs.map((doc) => [doc.id, doc.data()]));
        const entries = entriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
          const aInactive = a.status !== "normale";
          const bInactive = b.status !== "normale";
          if (aInactive !== bInactive) return aInactive ? 1 : -1;
          return b.points - a.points || (a.order ?? 0) - (b.order ?? 0);
        });
        frozenStandings = entries.map((entry) => ({
          id: entry.teamId,
          name: teams.get(entry.teamId)?.name ?? "Squadra eliminata",
          points: entry.points,
          played: entry.played,
          status: entry.status,
        }));
        const winner = entries.find((entry) => entry.status === "normale");
        if (winner) {
          winnerId = winner.teamId;
          winnerName = teams.get(winner.teamId)?.name ?? "Squadra eliminata";
        }
      } else {
        const participantsSnap = await transaction.get(
          db.collection("femaleParticipants").where("editionId", "==", editionId)
        );
        const participants = participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
          const aInactive = a.status !== "normale";
          const bInactive = b.status !== "normale";
          if (aInactive !== bInactive) return aInactive ? 1 : -1;
          return b.points - a.points || (a.order ?? 0) - (b.order ?? 0);
        });
        frozenStandings = participants.map((entry) => ({
          id: entry.id,
          name: entry.name,
          points: entry.points,
          stages: entry.stages,
          status: entry.status,
        }));
        const winner = participants.find((entry) => entry.status === "normale");
        if (winner) {
          winnerId = winner.id;
          winnerName = winner.name;
        }
      }

      let frozenBracket;
      if (edition.bracketEnabled && type.hasTeams) {
        const [roundsSnap, bracketMatchesSnap, teamsSnap] = await Promise.all([
          transaction.get(db.collection("bracketRounds").where("editionId", "==", editionId)),
          transaction.get(db.collection("bracketMatches").where("editionId", "==", editionId)),
          transaction.get(db.collection("teams")),
        ]);
        const teams = new Map(teamsSnap.docs.map((doc) => [doc.id, doc.data().name]));
        const rounds = roundsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.order - b.order);
        const bracketMatches = bracketMatchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        frozenBracket = rounds.map((round) => ({
          name: round.name,
          order: round.order,
          matches: bracketMatches.filter((match) => match.roundId === round.id).sort((a, b) => a.order - b.order).map((match) => ({
            ...(match.team1Id ? { team1Name: teams.get(match.team1Id) ?? "Squadra eliminata" } : {}),
            ...(match.team2Id ? { team2Name: teams.get(match.team2Id) ?? "Squadra eliminata" } : {}),
            ...(match.score ? { score: match.score } : {}),
            ...(match.winnerTeamId ? { winnerName: teams.get(match.winnerTeamId) ?? "Squadra eliminata" } : {}),
            ...(match.winnerTeamId === match.team1Id ? { winnerSide: 1 } : match.winnerTeamId === match.team2Id ? { winnerSide: 2 } : {}),
          })),
        }));
        const finalMatch = findBracketWinnerMatch(rounds, bracketMatches);
        if (!finalMatch?.winnerTeamId) {
          throw new HttpError(400, "Il tabellone e attivo: indica il vincitore della Finale prima di concludere l'edizione");
        }
        winnerId = finalMatch.winnerTeamId;
        winnerName = teams.get(finalMatch.winnerTeamId) ?? "Squadra eliminata";
      }

      if (!winnerName) throw new HttpError(400, "Impossibile determinare il vincitore dell'edizione");
      const [winsSnap, settingsSnap] = await Promise.all([
        transaction.get(db.collection("historicalWins").where("editionId", "==", editionId)),
        transaction.get(db.doc("notificationSettings/global")),
      ]);
      const after = {
        status: "conclusa",
        closedAt: timestamp,
        frozenStandings,
        ...(frozenBracket ? { frozenBracket } : {}),
        winnerId,
        winnerName,
      };
      transaction.update(editionRef, after);

      const winRef = winsSnap.empty ? db.collection("historicalWins").doc() : winsSnap.docs[0].ref;
      transaction.set(winRef, {
        typeId: edition.typeId,
        editionId,
        ...(type.hasTeams ? { teamId: winnerId } : { participantName: winnerName }),
        winnerNameSnapshot: winnerName,
        season: edition.season,
      }, { merge: true });

      const settings = settingsSnap.exists ? settingsSnap.data() : defaultNotificationSettings();
      const payload = buildNotificationPayload({
        type: "winner",
        title: "Campionato concluso",
        body: `${winnerName} vince ${type.name} ${edition.season}.`,
        url: `/campionati/${editionId}`,
        editionId,
      });
      const mode = resolveNotificationMode(settings, payload.type, editionId);
      if (mode !== "disabled") {
        const notificationId = `winner-${editionId}`;
        const notification = {
          id: notificationId,
          payload,
          eventType: payload.type,
          editionId,
          mode,
          status: mode === "automatic" ? "queued" : "draft",
          sourceRef: `championshipEditions/${editionId}`,
          createdAt: timestamp,
          createdBy: caller.uid,
        };
        transaction.set(db.doc(`notificationDrafts/${notificationId}`), notification, { merge: true });
        transaction.set(db.doc(`notificationHistory/${notificationId}`), {
          ...notification,
          successCount: 0,
          failureCount: 0,
        }, { merge: true });
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "edition_closed",
        entity: `championshipEditions/${editionId}`,
        detail: JSON.stringify({ role: caller.role, winnerName }),
        before: { status: edition.status, closedAt: edition.closedAt ?? null },
        after,
        timestamp,
      });
      result = { winnerName };
    });

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err, "Errore durante la conclusione dell'edizione");
  }
}
