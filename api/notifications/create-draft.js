import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload } from "../_lib/notifications.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const db = admin.firestore(app);
    const payload = buildNotificationPayload(req.body?.event);
    const scheduledAt = typeof req.body?.scheduledAt === "string" && req.body.scheduledAt ? req.body.scheduledAt : null;
    const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.slice(0, 120) : null;
    const now = new Date().toISOString();
    const ref = idempotencyKey ? db.doc(`notificationDrafts/${idempotencyKey}`) : db.collection("notificationDrafts").doc();

    await ref.set(
      {
        id: ref.id,
        payload,
        eventType: payload.type,
        editionId: payload.editionId,
        status: scheduledAt ? "scheduled" : "draft",
        scheduledAt,
        createdAt: now,
        createdBy: caller.uid,
        updatedAt: now,
      },
      { merge: false }
    );

    await db.collection("notificationHistory").doc(ref.id).set({
      id: ref.id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
      createdAt: now,
      createdBy: caller.uid,
      successCount: 0,
      failureCount: 0,
    });

    res.status(200).json({ ok: true, draftId: ref.id });
  } catch (err) {
    sendError(res, err, "Errore interno durante la creazione della bozza notifica");
  }
}
