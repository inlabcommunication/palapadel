import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const optionalText = z.string().trim().max(500).optional();
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"), typeId: documentId, teamId: documentId,
    season: z.string().trim().min(1).max(50), note: optionalText,
  }).strict(),
  z.object({
    operation: z.literal("create"), typeId: documentId, participantName: z.string().trim().min(2).max(120),
    season: z.string().trim().min(1).max(50), note: optionalText,
  }).strict(),
  z.object({
    operation: z.literal("update"), winId: documentId, season: z.string().trim().min(1).max(50),
    note: optionalText, participantName: z.string().trim().min(2).max(120).optional(),
  }).strict(),
  z.object({ operation: z.literal("delete"), winId: documentId }).strict(),
]);

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      let ref;
      let before = null;
      let after = null;
      if (input.operation === "create") {
        const typeSnap = await transaction.get(db.doc(`championshipTypes/${input.typeId}`));
        if (!typeSnap.exists) throw new HttpError(404, "Tipologia non trovata");
        if ("teamId" in input) {
          const teamSnap = await transaction.get(db.doc(`teams/${input.teamId}`));
          if (!teamSnap.exists) throw new HttpError(404, "Squadra non trovata");
          after = { typeId: input.typeId, teamId: input.teamId, winnerNameSnapshot: teamSnap.data().name, season: input.season, ...(input.note ? { note: input.note } : {}) };
        } else {
          after = { typeId: input.typeId, participantName: input.participantName, winnerNameSnapshot: input.participantName, season: input.season, ...(input.note ? { note: input.note } : {}) };
        }
        ref = db.collection("historicalWins").doc();
        after.id = ref.id;
        transaction.set(ref, after);
      } else {
        ref = db.doc(`historicalWins/${input.winId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new HttpError(404, "Vittoria non trovata");
        before = snap.data();
        if (input.operation === "delete") {
          transaction.delete(ref);
        } else {
          after = {
            ...before,
            season: input.season,
            note: input.note ?? "",
            ...("participantName" in input ? { participantName: input.participantName, winnerNameSnapshot: input.participantName } : {}),
          };
          transaction.update(ref, after);
        }
      }
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: `hall_of_fame_${input.operation}`,
        entity: `historicalWins/${ref.id}`,
        before,
        after,
        detail: JSON.stringify({ role: caller.role }),
        timestamp,
      });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore nella gestione dell'Albo d'oro");
  }
}
