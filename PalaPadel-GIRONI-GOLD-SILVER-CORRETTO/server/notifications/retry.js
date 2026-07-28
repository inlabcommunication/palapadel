import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { historyId } = parseBody(z.object({ historyId: documentId }).strict(), req.body);

    const db = admin.firestore(app);
    const historySnap = await db.doc(`notificationHistory/${historyId}`).get();
    if (!historySnap.exists) throw new HttpError(404, "Notifica non trovata");
    const payload = historySnap.data().payload;
    if (!payload) throw new HttpError(400, "La notifica non contiene un payload riutilizzabile");

    const retryRef = db.collection("notificationDrafts").doc();
    const now = new Date().toISOString();
    await retryRef.set({
      id: retryRef.id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      status: "draft",
      retryOf: historyId,
      createdAt: now,
      createdBy: caller.uid,
      updatedAt: now,
    });

    res.status(200).json({ ok: true, draftId: retryRef.id });
  } catch (err) {
    sendError(res, err, "Errore interno durante il retry notifica");
  }
}
