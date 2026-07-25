import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload } from "../_lib/notifications.js";
import { dispatchNotification } from "../_lib/notificationDispatch.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const db = admin.firestore(app);
    const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.slice(0, 120) : null;

    let draftRef = null;
    let payload = null;
    if (req.body?.draftId) {
      draftRef = db.doc(`notificationDrafts/${req.body.draftId}`);
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) throw new HttpError(404, "Bozza notifica non trovata");
      payload = draftSnap.data().payload;
    } else {
      payload = buildNotificationPayload(req.body?.event);
    }

    const result = await dispatchNotification(app, db, payload, caller.uid, { draftRef, idempotencyKey });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err, "Errore interno durante l'invio notifica");
  }
}
