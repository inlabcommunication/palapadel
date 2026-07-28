import { getAdminApp } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { enqueueNotificationEvent } from "../_lib/notificationEvents.js";
import { notificationEventSchema, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(z.object({
      event: notificationEventSchema,
      idempotencyKey: z.string().trim().min(1).max(120).optional(),
      sourceRef: z.string().trim().min(1).max(300).optional(),
    }).strict(), req.body);
    const notification = await enqueueNotificationEvent(app, input.event, {
      createdBy: caller.uid,
      idempotencyKey: input.idempotencyKey,
      sourceRef: input.sourceRef,
    });
    res.status(200).json({ ok: true, notification });
  } catch (err) {
    sendError(res, err, "Errore interno durante la gestione evento notifica");
  }
}
