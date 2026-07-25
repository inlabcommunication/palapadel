import { getAdminApp } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { enqueueNotificationEvent } from "../_lib/notificationEvents.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const notification = await enqueueNotificationEvent(app, req.body?.event, {
      createdBy: caller.uid,
      idempotencyKey: typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined,
      sourceRef: typeof req.body?.sourceRef === "string" ? req.body.sourceRef : undefined,
    });
    res.status(200).json({ ok: true, notification });
  } catch (err) {
    sendError(res, err, "Errore interno durante la gestione evento notifica");
  }
}
