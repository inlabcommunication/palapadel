import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const participantData = {
  name: z.string().trim().min(2).max(120),
  calculatedPoints: z.number().finite(),
  manualPointsAdjustment: z.number().finite(),
  stages: z.number().int().min(0),
  order: z.number().int().min(0),
  status: z.enum(["normale", "ritirata", "squalificata"]),
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), editionId: documentId, name: participantData.name }).strict(),
  z.object({ operation: z.literal("update"), participantId: documentId, editionId: documentId, ...participantData }).strict(),
  z.object({ operation: z.literal("delete"), participantId: documentId, editionId: documentId }).strict(),
  z.object({
    operation: z.literal("recalculate"),
    editionId: documentId,
    changes: z.array(z.object({ participantId: documentId, points: z.number().finite() }).strict()).min(1).max(500),
  }).strict(),
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
      const editionSnap = await transaction.get(db.doc(`championshipEditions/${input.editionId}`));
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      let before = null;
      let after = null;
      let entity = `championshipEditions/${input.editionId}`;

      if (input.operation === "create") {
        const ref = db.collection("femaleParticipants").doc();
        after = { id: ref.id, editionId: input.editionId, name: input.name, points: 0, stages: 0, order: Date.now(), status: "normale" };
        transaction.set(ref, after);
        entity = `femaleParticipants/${ref.id}`;
      } else if (input.operation === "update" || input.operation === "delete") {
        const ref = db.doc(`femaleParticipants/${input.participantId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().editionId !== input.editionId) throw new HttpError(404, "Giocatrice non trovata");
        before = snap.data();
        entity = `femaleParticipants/${input.participantId}`;
        if (input.operation === "delete") {
          transaction.delete(ref);
        } else {
          after = {
            ...before,
            name: input.name,
            calculatedPoints: input.calculatedPoints,
            manualPointsAdjustment: input.manualPointsAdjustment,
            points: input.calculatedPoints + input.manualPointsAdjustment,
            stages: input.stages,
            order: input.order,
            status: input.status,
          };
          transaction.update(ref, after);
        }
      } else {
        const snapshots = await Promise.all(input.changes.map((change) => transaction.get(db.doc(`femaleParticipants/${change.participantId}`))));
        snapshots.forEach((snap, index) => {
          if (!snap.exists || snap.data().editionId !== input.editionId) throw new HttpError(400, "Dati classifica non coerenti");
          transaction.update(snap.ref, { points: input.changes[index].points });
        });
        after = { changed: input.changes.length };
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: `female_${input.operation}`,
        entity,
        before,
        after,
        detail: JSON.stringify({ role: caller.role, editionId: input.editionId }),
        timestamp,
      });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore nella gestione della classifica femminile");
  }
}
