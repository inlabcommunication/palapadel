import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload } from "../_lib/notifications.js";
import { notificationEventSchema, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(z.object({ scheduledAt: z.string().datetime(), event: notificationEventSchema }).strict(), req.body);
    const scheduledAt = input.scheduledAt;

    const db = admin.firestore(app);
    const payload = buildNotificationPayload(input.event);
    const now = new Date().toISOString();
    const ref = db.collection("notificationDrafts").doc();
    await ref.set({
      id: ref.id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      status: "scheduled",
      scheduledAt,
      createdAt: now,
      createdBy: caller.uid,
      updatedAt: now,
    });

    await db.collection("notificationHistory").doc(ref.id).set({
      id: ref.id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      status: "scheduled",
      scheduledAt,
      createdAt: now,
      createdBy: caller.uid,
      successCount: 0,
      failureCount: 0,
    });

    res.status(200).json({ ok: true, draftId: ref.id });
  } catch (err) {
    sendError(res, err, "Errore interno durante la programmazione notifica");
  }
}
