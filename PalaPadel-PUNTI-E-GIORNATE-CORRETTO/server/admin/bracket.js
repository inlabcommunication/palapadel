import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { propagateBracketWinner, validateBracketSources } from "../../shared/bracketProgression.js";

const optionalId = z.union([documentId, z.literal(""), z.null()]).optional();
const matchFields = {
  team1Id: optionalId,
  team2Id: optionalId,
  team1SourceMatchId: optionalId,
  team2SourceMatchId: optionalId,
  score: z.string().trim().max(50).optional(),
  winnerTeamId: optionalId,
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("toggle"), editionId: documentId, enabled: z.boolean() }).strict(),
  z.object({ operation: z.literal("createRound"), editionId: documentId, name: z.string().trim().min(1).max(100), order: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("moveRound"), editionId: documentId, roundId: documentId, roundOrder: z.number().int().min(0), otherRoundId: documentId, otherOrder: z.number().int().min(0) }).strict(),
  z.object({ operation: z.literal("renameRound"), editionId: documentId, roundId: documentId, name: z.string().trim().min(1).max(100) }).strict(),
  z.object({ operation: z.literal("deleteRound"), editionId: documentId, roundId: documentId }).strict(),
  z.object({ operation: z.literal("generateRound"), editionId: documentId, roundId: documentId, matches: z.array(z.object({ order: z.number().int().min(0), ...matchFields }).strict()).max(100) }).strict(),
  z.object({ operation: z.literal("createMatch"), editionId: documentId, roundId: documentId, order: z.number().int().min(0), ...matchFields }).strict(),
  z.object({ operation: z.literal("updateMatch"), editionId: documentId, matchId: documentId, ...matchFields }).strict(),
  z.object({ operation: z.literal("deleteMatch"), editionId: documentId, matchId: documentId }).strict(),
]);

const cleanMatch = (input) => ({
  ...(input.team1Id ? { team1Id: input.team1Id } : {}),
  ...(input.team2Id ? { team2Id: input.team2Id } : {}),
  ...(input.team1SourceMatchId ? { team1SourceMatchId: input.team1SourceMatchId } : {}),
  ...(input.team2SourceMatchId ? { team2SourceMatchId: input.team2SourceMatchId } : {}),
  ...(input.score ? { score: input.score } : {}),
  ...(input.winnerTeamId ? { winnerTeamId: input.winnerTeamId } : {}),
});

const mutableMatchFields = ["team1Id", "team2Id", "team1SourceMatchId", "team2SourceMatchId", "score", "winnerTeamId"];

const valueOrNull = (value) => value || null;

function buildMatchUpdate(before, input, matchesById) {
  const next = { ...before };
  mutableMatchFields.forEach((field) => {
    if (input[field] !== undefined) next[field] = valueOrNull(input[field]);
  });

  if (input.team1SourceMatchId !== undefined) {
    next.team1Id = next.team1SourceMatchId ? matchesById.get(next.team1SourceMatchId)?.winnerTeamId || null : next.team1Id;
  }
  if (input.team2SourceMatchId !== undefined) {
    next.team2Id = next.team2SourceMatchId ? matchesById.get(next.team2SourceMatchId)?.winnerTeamId || null : next.team2Id;
  }
  return next;
}

function validateMatch(match) {
  if (match.team1Id && match.team1Id === match.team2Id) {
    throw new HttpError(400, "Una squadra non puo giocare contro se stessa");
  }
  if (match.winnerTeamId && ![match.team1Id, match.team2Id].includes(match.winnerTeamId)) {
    throw new HttpError(400, "Il vincitore deve essere una delle due squadre dell'incontro");
  }
}

function validateSources(match, matchesById) {
  const validationMap = new Map(matchesById);
  validationMap.set(match.id, match);
  try {
    validateBracketSources(match, validationMap);
  } catch (error) {
    if (error instanceof Error && error.message === "CIRCULAR_BRACKET_SOURCE") {
      throw new HttpError(400, "Gli incontri del tabellone non possono creare un collegamento circolare");
    }
    throw new HttpError(400, "L'incontro sorgente selezionato non esiste");
  }
}

function firestoreMatchUpdate(match) {
  return Object.fromEntries(mutableMatchFields.map((field) => [
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
        const [round, matchSnapshots] = await Promise.all([
          transaction.get(db.doc(`bracketRounds/${input.roundId}`)),
          transaction.get(db.collection("bracketMatches").where("editionId", "==", input.editionId)),
        ]);
        if (!round.exists || round.data().editionId !== input.editionId) throw new HttpError(404, "Turno non trovato");
        const matchesById = new Map(matchSnapshots.docs.map((doc) => [doc.id, doc.data()]));
        const ref = db.collection("bracketMatches").doc();
        createdId = ref.id;
        after = buildMatchUpdate(
          { id: ref.id, editionId: input.editionId, roundId: input.roundId, order: input.order },
          input,
          matchesById
        );
        validateSources(after, matchesById);
        validateMatch(after);
        transaction.set(ref, after);
        entity = `bracketMatches/${ref.id}`;
      } else {
        const ref = db.doc(`bracketMatches/${input.matchId}`);
        const [snap, matchSnapshots] = await Promise.all([
          transaction.get(ref),
          transaction.get(db.collection("bracketMatches").where("editionId", "==", input.editionId)),
        ]);
        if (!snap.exists || snap.data().editionId !== input.editionId) throw new HttpError(404, "Incontro non trovato");
        before = snap.data();
        entity = `bracketMatches/${input.matchId}`;
        if (input.operation === "deleteMatch") transaction.delete(ref);
        else {
          const matchesById = new Map(matchSnapshots.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
          after = buildMatchUpdate(before, input, matchesById);
          validateSources(after, matchesById);
          validateMatch(after);
          transaction.update(ref, firestoreMatchUpdate(after));

          matchesById.set(input.matchId, after);
          const propagated = propagateBracketWinner(matchesById, input.matchId, after.winnerTeamId);
          for (const changed of propagated.values()) {
            validateMatch(changed);
            transaction.update(db.doc(`bracketMatches/${changed.id}`), firestoreMatchUpdate(changed));
          }
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
