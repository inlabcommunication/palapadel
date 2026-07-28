import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { propagateBracketWinner, validateBracketSources } from "../../shared/bracketProgression.js";
import { canPerformTournamentOperation } from "../../shared/tournamentPermissions.js";
import { buildTournamentDisplayName, buildTournamentMemberKey, normalizeTournamentMember } from "../../shared/tournamentTeams.js";

const optionalId = z.union([documentId, z.literal(""), z.null()]).optional();
const bracketKey = z.enum(["main", "gold", "silver"]);
const status = z.enum(["bozza", "in_corso", "concluso"]);
const matchFields = {
  team1Id: optionalId,
  team2Id: optionalId,
  team1SourceMatchId: optionalId,
  team2SourceMatchId: optionalId,
  score: z.string().trim().max(50).optional(),
  winnerTeamId: optionalId,
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("createTournament"), name: z.string().trim().min(1).max(120), season: z.string().trim().min(1).max(40), bracketMode: z.enum(["unico", "gold_silver"]), status, isPubliclyVisible: z.boolean() }).strict(),
  z.object({ operation: z.literal("updateTournament"), tournamentId: documentId, name: z.string().trim().min(1).max(120), season: z.string().trim().min(1).max(40), bracketMode: z.enum(["unico", "gold_silver"]), status, isPubliclyVisible: z.boolean() }).strict(),
  z.object({ operation: z.literal("deleteTournament"), tournamentId: documentId }).strict(),
  z.object({ operation: z.literal("setTournamentLogo"), tournamentId: documentId, logoUrl: z.string().url().max(2000), logoStoragePath: z.string().trim().min(3).max(1000), logoAlt: z.string().trim().min(1).max(200) }).strict(),
  z.object({ operation: z.literal("removeTournamentLogo"), tournamentId: documentId }).strict(),
  z.object({ operation: z.literal("createGroup"), tournamentId: documentId, name: z.string().trim().min(1).max(80), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("updateGroup"), tournamentId: documentId, groupId: documentId, name: z.string().trim().min(1).max(80), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("deleteGroup"), tournamentId: documentId, groupId: documentId }).strict(),
  z.object({ operation: z.literal("addGroupTeam"), tournamentId: documentId, groupId: documentId, member1: z.string().trim().min(1).max(80), member2: z.string().trim().min(1).max(80), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("updateGroupTeam"), tournamentId: documentId, entryId: documentId, played: z.number().int().min(0).max(999), won: z.number().int().min(0).max(999), lost: z.number().int().min(0).max(999), points: z.number().int().min(-999).max(9999), order: z.number().int().min(0), qualified: z.boolean() }).strict(),
  z.object({ operation: z.literal("removeGroupTeam"), tournamentId: documentId, entryId: documentId }).strict(),
  z.object({ operation: z.literal("createRound"), tournamentId: documentId, bracketKey, name: z.string().trim().min(1).max(80), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("updateRound"), tournamentId: documentId, roundId: documentId, name: z.string().trim().min(1).max(80), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("deleteRound"), tournamentId: documentId, roundId: documentId }).strict(),
  z.object({ operation: z.literal("createMatch"), tournamentId: documentId, bracketKey, roundId: documentId, order: z.number().int().min(0), ...matchFields }).strict(),
  z.object({ operation: z.literal("updateMatch"), tournamentId: documentId, matchId: documentId, ...matchFields }).strict(),
  z.object({ operation: z.literal("deleteMatch"), tournamentId: documentId, matchId: documentId }).strict(),
]);

const matchFieldNames = ["team1Id", "team2Id", "team1SourceMatchId", "team2SourceMatchId", "score", "winnerTeamId"];
const clean = (value) => value || null;

function matchUpdate(before, input, matches) {
  const next = { ...before };
  matchFieldNames.forEach((field) => {
    if (input[field] !== undefined) next[field] = clean(input[field]);
  });
  if (input.team1SourceMatchId !== undefined && next.team1SourceMatchId) next.team1Id = matches.get(next.team1SourceMatchId)?.winnerTeamId || null;
  if (input.team2SourceMatchId !== undefined && next.team2SourceMatchId) next.team2Id = matches.get(next.team2SourceMatchId)?.winnerTeamId || null;
  return next;
}

function validateMatch(match, matches) {
  if (match.team1Id && match.team1Id === match.team2Id) throw new HttpError(400, "Una squadra non puo giocare contro se stessa");
  if (match.winnerTeamId && ![match.team1Id, match.team2Id].includes(match.winnerTeamId)) {
    throw new HttpError(400, "Il vincitore deve essere una delle due squadre");
  }
  const validationMap = new Map(matches);
  validationMap.set(match.id, match);
  try {
    validateBracketSources(match, validationMap);
  } catch {
    throw new HttpError(400, "Collegamento tra incontri non valido o circolare");
  }
}

function firestoreMatch(match) {
  return Object.fromEntries(matchFieldNames.map((field) => [
    field,
    match[field] || admin.firestore.FieldValue.delete(),
  ]));
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin", "admin"]);
    const input = parseBody(schema, req.body);
    if (!canPerformTournamentOperation(caller.role, input.operation)) {
      throw new HttpError(403, "Permessi insufficienti per questa operazione sul torneo");
    }
    if (input.operation === "updateGroupTeam" && input.won + input.lost > input.played) {
      throw new HttpError(400, "Vittorie e sconfitte non possono superare le partite giocate");
    }
    const db = admin.firestore(app);
    let createdId;

    await db.runTransaction(async (transaction) => {
      let entity = `tournaments/${input.tournamentId || "new"}`;
      let before = null;
      let after = null;
      const tournamentRef = input.tournamentId ? db.doc(`tournaments/${input.tournamentId}`) : null;
      const tournamentSnap = tournamentRef ? await transaction.get(tournamentRef) : null;
      if (tournamentRef && !tournamentSnap.exists) throw new HttpError(404, "Torneo non trovato");

      if (input.operation === "createTournament") {
        const ref = db.collection("tournaments").doc();
        createdId = ref.id;
        after = { id: ref.id, name: input.name, season: input.season, bracketMode: input.bracketMode, status: input.status, isPubliclyVisible: input.isPubliclyVisible, createdAt: new Date().toISOString() };
        transaction.set(ref, after);
        entity = `tournaments/${ref.id}`;
      } else if (input.operation === "updateTournament") {
        before = tournamentSnap.data();
        after = { ...before, name: input.name, season: input.season, bracketMode: input.bracketMode, status: input.status, isPubliclyVisible: input.isPubliclyVisible };
        transaction.update(tournamentRef, after);
      } else if (input.operation === "setTournamentLogo" || input.operation === "removeTournamentLogo") {
        before = tournamentSnap.data();
        if (input.operation === "setTournamentLogo") {
          const expectedPrefix = `tournaments/${input.tournamentId}/logo/`;
          if (!input.logoStoragePath.startsWith(expectedPrefix)) throw new HttpError(400, "Percorso del logo non valido");
          after = { ...before, logoUrl: input.logoUrl, logoStoragePath: input.logoStoragePath, logoAlt: input.logoAlt };
          transaction.update(tournamentRef, { logoUrl: input.logoUrl, logoStoragePath: input.logoStoragePath, logoAlt: input.logoAlt });
        } else {
          after = { ...before, logoUrl: null, logoStoragePath: null, logoAlt: null };
          transaction.update(tournamentRef, {
            logoUrl: admin.firestore.FieldValue.delete(),
            logoStoragePath: admin.firestore.FieldValue.delete(),
            logoAlt: admin.firestore.FieldValue.delete(),
          });
        }
      } else if (input.operation === "deleteTournament") {
        before = tournamentSnap.data();
        const collections = ["tournamentGroups", "tournamentTeams", "tournamentGroupTeams", "tournamentBracketRounds", "tournamentBracketMatches"];
        const snapshots = await Promise.all(collections.map((name) => transaction.get(db.collection(name).where("tournamentId", "==", input.tournamentId))));
        snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => transaction.delete(doc.ref)));
        if (before.logoStoragePath) {
          transaction.set(db.collection("storageCleanupQueue").doc(), {
            storagePath: before.logoStoragePath,
            reason: "Logo di un torneo eliminato",
            status: "pending",
            attempts: 0,
            createdAt: new Date().toISOString(),
            createdBy: caller.uid,
          });
        }
        transaction.delete(tournamentRef);
      } else if (input.operation === "createGroup") {
        const ref = db.collection("tournamentGroups").doc();
        createdId = ref.id;
        after = { id: ref.id, tournamentId: input.tournamentId, name: input.name, order: input.order };
        transaction.set(ref, after);
        entity = `tournamentGroups/${ref.id}`;
      } else if (["updateGroup", "deleteGroup"].includes(input.operation)) {
        const ref = db.doc(`tournamentGroups/${input.groupId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().tournamentId !== input.tournamentId) throw new HttpError(404, "Girone non trovato");
        before = snap.data();
        entity = `tournamentGroups/${input.groupId}`;
        if (input.operation === "updateGroup") transaction.update(ref, { name: input.name, order: input.order });
        else {
          const entries = await transaction.get(db.collection("tournamentGroupTeams").where("groupId", "==", input.groupId));
          entries.docs.forEach((doc) => {
            transaction.delete(doc.ref);
            if (doc.data().teamId) transaction.delete(db.doc(`tournamentTeams/${doc.data().teamId}`));
          });
          transaction.delete(ref);
        }
      } else if (input.operation === "addGroupTeam") {
        const key = buildTournamentMemberKey(input.member1, input.member2);
        if (normalizeTournamentMember(input.member1) === normalizeTournamentMember(input.member2)) {
          throw new HttpError(400, "I due membri della coppia devono essere persone diverse");
        }
        const [group, duplicate] = await Promise.all([
          transaction.get(db.doc(`tournamentGroups/${input.groupId}`)),
          transaction.get(db.collection("tournamentTeams").where("tournamentId", "==", input.tournamentId).where("memberKey", "==", key)),
        ]);
        if (!group.exists || group.data().tournamentId !== input.tournamentId) throw new HttpError(404, "Girone non trovato");
        if (!duplicate.empty) throw new HttpError(409, "La squadra e gia inserita in un girone del torneo");
        const teamRef = db.collection("tournamentTeams").doc();
        const entryRef = db.collection("tournamentGroupTeams").doc();
        createdId = entryRef.id;
        const team = { id: teamRef.id, tournamentId: input.tournamentId, groupId: input.groupId, member1: input.member1, member2: input.member2, displayName: buildTournamentDisplayName(input.member1, input.member2), memberKey: key };
        after = {
          id: entryRef.id,
          tournamentId: input.tournamentId,
          groupId: input.groupId,
          teamId: teamRef.id,
          member1: input.member1,
          member2: input.member2,
          displayName: team.displayName,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          qualified: false,
          order: input.order,
        };
        transaction.set(teamRef, team);
        transaction.set(entryRef, after);
        entity = `tournamentGroupTeams/${entryRef.id}`;
      } else if (["updateGroupTeam", "removeGroupTeam"].includes(input.operation)) {
        const ref = db.doc(`tournamentGroupTeams/${input.entryId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().tournamentId !== input.tournamentId) throw new HttpError(404, "Squadra del girone non trovata");
        before = snap.data();
        entity = `tournamentGroupTeams/${input.entryId}`;
        if (input.operation === "removeGroupTeam") {
          transaction.delete(ref);
          if (before.teamId) transaction.delete(db.doc(`tournamentTeams/${before.teamId}`));
        }
        else {
          after = { ...before, played: input.played, won: input.won, lost: input.lost, points: input.points, order: input.order, qualified: input.qualified };
          transaction.update(ref, after);
        }
      } else if (input.operation === "createRound") {
        const ref = db.collection("tournamentBracketRounds").doc();
        createdId = ref.id;
        after = { id: ref.id, tournamentId: input.tournamentId, bracketKey: input.bracketKey, name: input.name, order: input.order };
        transaction.set(ref, after);
        entity = `tournamentBracketRounds/${ref.id}`;
      } else if (["updateRound", "deleteRound"].includes(input.operation)) {
        const ref = db.doc(`tournamentBracketRounds/${input.roundId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().tournamentId !== input.tournamentId) throw new HttpError(404, "Turno non trovato");
        before = snap.data();
        entity = `tournamentBracketRounds/${input.roundId}`;
        if (input.operation === "updateRound") transaction.update(ref, { name: input.name, order: input.order });
        else {
          const matches = await transaction.get(db.collection("tournamentBracketMatches").where("roundId", "==", input.roundId));
          matches.docs.forEach((doc) => transaction.delete(doc.ref));
          transaction.delete(ref);
        }
      } else if (input.operation === "createMatch") {
        const [round, matchSnaps] = await Promise.all([
          transaction.get(db.doc(`tournamentBracketRounds/${input.roundId}`)),
          transaction.get(db.collection("tournamentBracketMatches").where("tournamentId", "==", input.tournamentId)),
        ]);
        if (!round.exists || round.data().tournamentId !== input.tournamentId || round.data().bracketKey !== input.bracketKey) throw new HttpError(404, "Turno non trovato");
        const matches = new Map(matchSnaps.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
        const ref = db.collection("tournamentBracketMatches").doc();
        createdId = ref.id;
        after = matchUpdate({ id: ref.id, tournamentId: input.tournamentId, bracketKey: input.bracketKey, roundId: input.roundId, order: input.order }, input, matches);
        validateMatch(after, matches);
        transaction.set(ref, after);
        entity = `tournamentBracketMatches/${ref.id}`;
      } else {
        const ref = db.doc(`tournamentBracketMatches/${input.matchId}`);
        const [snap, matchSnaps] = await Promise.all([
          transaction.get(ref),
          transaction.get(db.collection("tournamentBracketMatches").where("tournamentId", "==", input.tournamentId)),
        ]);
        if (!snap.exists || snap.data().tournamentId !== input.tournamentId) throw new HttpError(404, "Incontro non trovato");
        before = snap.data();
        entity = `tournamentBracketMatches/${input.matchId}`;
        if (input.operation === "deleteMatch") transaction.delete(ref);
        else {
          const matches = new Map(matchSnaps.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
          after = matchUpdate(before, input, matches);
          validateMatch(after, matches);
          transaction.update(ref, firestoreMatch(after));
          matches.set(after.id, after);
          for (const changed of propagateBracketWinner(matches, after.id, after.winnerTeamId).values()) {
            validateMatch(changed, matches);
            transaction.update(db.doc(`tournamentBracketMatches/${changed.id}`), firestoreMatch(changed));
          }
        }
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: `tournament_${input.operation}`,
        entity,
        before,
        after,
        detail: JSON.stringify({ role: caller.role, tournamentId: input.tournamentId || createdId }),
        timestamp: new Date().toISOString(),
      });
    });
    res.status(200).json({ ok: true, ...(createdId ? { id: createdId } : {}) });
  } catch (error) {
    sendError(res, error, "Errore nella gestione del torneo");
  }
}
