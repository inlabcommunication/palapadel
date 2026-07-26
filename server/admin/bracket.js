import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const optionalId = z.union([documentId, z.literal(""), z.null()]).optional();
const matchFields = {
  team1Id: optionalId,
  team2Id: optionalId,
  score: z.string().trim().max(50).optional(),
  winnerTeamId: optionalId,
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("toggle"), editionId: documentId, enabled: z.boolean() }).strict(),
  z.object({ operation: z.literal("createRound"), editionId: documentId, name: z.string().trim().min(1).max(100), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("moveRound"), editionId: documentId, roundId: documentId, roundOrder: z.number().int().min(0), otherRoundId: documentId, otherOrder: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("renameRound"), editionId: documentId, roundId: documentId, name: z.string().trim().min(1).max(100) }).strict(),
  z.object({ operation: z.literal("deleteRound"), editionId: documentId, roundId: documentId }).strict(),
  z.object({ operation: z.literal("generateRound"), editionId: documentId, roundId: documentId, matches: z.array(z.object({ order: z.number().int().min(0), team1Id: optionalId, team2Id: optionalId }).strict()).max(100) }).strict(),
  z.object({ operation: z.literal("createMatch"), editionId: documentId, roundId: documentId, order: z.number().int().min(0), ...matchFields }).strict(),
  z.object({ operation: z.literal("updateMatch"), editionId: documentId, matchId: documentId, ...matchFields }).strict(),
  z.object({ operation: z.literal("deleteMatch"), editionId: documentId, matchId: documentId }).strict(),
]);

const cleanMatch = (input) => ({
  ...(input.team1Id ? { team1Id: input.team1Id } : {}),
  ...(input.team2Id ? { team2Id: input.team2Id } : {}),
  ...(input.score ? { score: input.score } : {}),
  ...(input.winnerTeamId ? { winnerTeamId: input.winnerTeamId } : {}),
});

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    let createdId;

    await db.runTransaction(async (transaction) => {
      const editionRef = db.doc(`championshipEditions/${input.editionId}`);
      if (!(await transaction.get(editionRef)).exists) throw new HttpError(404, "Edizione non trovata");
      let before = null;
      let after = null;
      let entity = `championshipEditions/${input.editionId}`;

      if (input.operation === "toggle") {
        transaction.update(editionRef, { bracketEnabled: input.enabled });
        after = { bracketEnabled: input.enabled };
      } else if (input.operation === "createRound") {
        const ref = db.collection("bracketRounds").doc();
        createdId = ref.id;
        after = { id: ref.id, editionId: input.editionId, name: input.name, order: input.order };
        transaction.set(ref, after);
        entity = `bracketRounds/${ref.id}`;
      } else if (input.operation === "moveRound") {
        const firstRef = db.doc(`bracketRounds/${input.roundId}`);
        const secondRef = db.doc(`bracketRounds/${input.otherRoundId}`);
        const [first, second] = await Promise.all([transaction.get(firstRef), transaction.get(secondRef)]);
        if (!first.exists || !second.exists || first.data().editionId !== input.editionId || second.data().editionId !== input.editionId) throw new HttpError(404, "Turno non trovato");
        before = { first: first.data(), second: second.data() };
        transaction.update(firstRef, { order: input.roundOrder });
        transaction.update(secondRef, { order: input.otherOrder });
        after = { first: { ...first.data(), order: input.roundOrder }, second: { ...second.data(), order: input.otherOrder } };
      } else if (["renameRound", "deleteRound"].includes(input.operation)) {
        const ref = db.doc(`bracketRounds/${input.roundId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().editionId !== input.editionId) throw new HttpError(404, "Turno non trovato");
        before = snap.data();
        entity = `bracketRounds/${input.roundId}`;
        if (input.operation === "renameRound") {
          after = { ...before, name: input.name };
          transaction.update(ref, { name: input.name });
        } else {
          const matches = await transaction.get(db.collection("bracketMatches").where("roundId", "==", input.roundId));
          matches.docs.forEach((doc) => transaction.delete(doc.ref));
          transaction.delete(ref);
        }
      } else if (input.operation === "generateRound") {
        const roundRef = db.doc(`bracketRounds/${input.roundId}`);
        const round = await transaction.get(roundRef);
        if (!round.exists || round.data().editionId !== input.editionId) throw new HttpError(404, "Turno non trovato");
        const existing = await transaction.get(db.collection("bracketMatches").where("roundId", "==", input.roundId));
        existing.docs.forEach((doc) => transaction.delete(doc.ref));
        input.matches.forEach((match) => {
          const ref = db.collection("bracketMatches").doc();
          transaction.set(ref, { id: ref.id, editionId: input.editionId, roundId: input.roundId, order: match.order, ...cleanMatch(match) });
        });
        after = { generated: input.matches.length };
      } else if (input.operation === "createMatch") {
        if (input.team1Id && input.team1Id === input.team2Id) throw new HttpError(400, "Una squadra non puo giocare contro se stessa");
        if (input.winnerTeamId && ![input.team1Id, input.team2Id].includes(input.winnerTeamId)) {
          throw new HttpError(400, "Il vincitore deve essere una delle due squadre dell'incontro");
        }
        const round = await transaction.get(db.doc(`bracketRounds/${input.roundId}`));
        if (!round.exists || round.data().editionId !== input.editionId) throw new HttpError(404, "Turno non trovato");
        const ref = db.collection("bracketMatches").doc();
        createdId = ref.id;
        after = { id: ref.id, editionId: input.editionId, roundId: input.roundId, order: input.order, ...cleanMatch(input) };
        transaction.set(ref, after);
        entity = `bracketMatches/${ref.id}`;
      } else {
        const ref = db.doc(`bracketMatches/${input.matchId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().editionId !== input.editionId) throw new HttpError(404, "Incontro non trovato");
        before = snap.data();
        entity = `bracketMatches/${input.matchId}`;
        if (input.operation === "deleteMatch") transaction.delete(ref);
        else {
          if (input.team1Id && input.team1Id === input.team2Id) throw new HttpError(400, "Una squadra non puo giocare contro se stessa");
          const nextTeam1Id = input.team1Id !== undefined ? input.team1Id || null : before.team1Id;
          const nextTeam2Id = input.team2Id !== undefined ? input.team2Id || null : before.team2Id;
          const nextWinnerTeamId = input.winnerTeamId !== undefined ? input.winnerTeamId || null : before.winnerTeamId;
          if (nextWinnerTeamId && ![nextTeam1Id, nextTeam2Id].includes(nextWinnerTeamId)) {
            throw new HttpError(400, "Il vincitore deve essere una delle due squadre dell'incontro");
          }
          after = { ...before, ...cleanMatch(input) };
          const cleared = { team1Id: admin.firestore.FieldValue.delete(), team2Id: admin.firestore.FieldValue.delete(), score: admin.firestore.FieldValue.delete(), winnerTeamId: admin.firestore.FieldValue.delete() };
          transaction.update(ref, { ...cleared, ...cleanMatch(input) });
        }
      }
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid, action: `bracket_${input.operation}`, entity, before, after,
        detail: JSON.stringify({ role: caller.role, editionId: input.editionId }), timestamp,
      });
    });
    res.status(200).json({ ok: true, ...(createdId ? { id: createdId } : {}) });
  } catch (error) {
    sendError(res, error, "Errore nella gestione del tabellone");
  }
}
