import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("reorder"),
    orderedIds: z.array(documentId).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, "ID duplicati"),
  }).strict(),
  z.object({
    operation: z.literal("visibility"),
    editionId: documentId,
    isPubliclyVisible: z.boolean(),
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
      if (input.operation === "reorder") {
        const refs = input.orderedIds.map((id) => db.doc(`championshipEditions/${id}`));
        const snapshots = await transaction.getAll(...refs);
        if (snapshots.some((snapshot) => !snapshot.exists)) throw new HttpError(404, "Uno o più campionati non esistono");

        const before = snapshots.map((snapshot) => ({
          id: snapshot.id,
          displayOrder: snapshot.data().displayOrder ?? null,
        }));
        refs.forEach((ref, index) => transaction.update(ref, { displayOrder: index }));
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "championships_reordered",
          entity: "championshipEditions",
          detail: JSON.stringify({ role: caller.role }),
          before,
          after: input.orderedIds.map((id, displayOrder) => ({ id, displayOrder })),
          timestamp,
        });
        return;
      }

      const ref = db.doc(`championshipEditions/${input.editionId}`);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new HttpError(404, "Campionato non trovato");
      const previous = snapshot.data().isPubliclyVisible !== false;
      transaction.update(ref, { isPubliclyVisible: input.isPubliclyVisible });
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "championship_visibility_changed",
        entity: `championshipEditions/${input.editionId}`,
        detail: JSON.stringify({ role: caller.role }),
        before: { isPubliclyVisible: previous },
        after: { isPubliclyVisible: input.isPubliclyVisible },
        timestamp,
      });
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore durante l'aggiornamento dei campionati");
  }
}
