import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload } from "../_lib/notifications.js";
import { dispatchNotification } from "../_lib/notificationDispatch.js";
import { documentId, notificationEventSchema, parseBody, z } from "../_lib/validation.js";
import { hasPermission, PERMISSIONS } from "../../shared/permissions.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req);
    if (!hasPermission(caller.role, PERMISSIONS.SEND_NOTIFICATIONS)) {
      throw new HttpError(403, "Permessi insufficienti");
    }
    const db = admin.firestore(app);
    const input = parseBody(z.union([
      z.object({ draftId: documentId, idempotencyKey: z.string().trim().max(120).optional() }).strict(),
      z.object({ event: notificationEventSchema, idempotencyKey: z.string().trim().max(120).optional() }).strict(),
    ]), req.body);
    const idempotencyKey = input.idempotencyKey ?? null;

    let draftRef = null;
    let payload = null;
    if ("draftId" in input) {
      draftRef = db.doc(`notificationDrafts/${input.draftId}`);
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) throw new HttpError(404, "Bozza notifica non trovata");
      payload = draftSnap.data().payload;
    } else {
      payload = buildNotificationPayload(input.event);
    }

    const result = await dispatchNotification(app, db, payload, caller.uid, { draftRef, idempotencyKey });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err, "Errore interno durante l'invio notifica");
  }
}
