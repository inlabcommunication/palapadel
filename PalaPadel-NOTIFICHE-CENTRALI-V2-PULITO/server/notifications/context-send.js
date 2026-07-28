import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload } from "../_lib/notifications.js";
import { dispatchNotification } from "../_lib/notificationDispatch.js";
import { CONTEXT_NOTIFICATION_KINDS, buildContextNotification } from "../_lib/contextNotifications.js";
import { hasPermission, PERMISSIONS } from "../../shared/permissions.js";
import { parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const { kinds } = parseBody(z.object({
      kinds: z.array(z.enum(CONTEXT_NOTIFICATION_KINDS)).min(1).max(3),
    }).strict(), req.body);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req);
    if (!hasPermission(caller.role, PERMISSIONS.SEND_NOTIFICATIONS)) {
      throw new HttpError(403, "Permessi insufficienti");
    }

    const db = admin.firestore(app);
    const sentAt = new Date().toISOString();
    const results = [];
    for (const kind of [...new Set(kinds)]) {
      const payload = buildNotificationPayload(buildContextNotification(kind));
      const result = await dispatchNotification(app, db, payload, caller.uid, {
        idempotencyKey: `manual-context-${kind}-${Date.now()}`,
      });
      results.push({ kind, status: result.status, successCount: result.successCount, failureCount: result.failureCount });
    }
    await db.doc("notificationSettings/manualContextState").set({
      lastSentAt: sentAt,
      lastSentKinds: [...new Set(kinds)],
      lastSentBy: caller.uid,
    }, { merge: true });

    res.status(200).json({ ok: true, results, sentAt });
  } catch (err) {
    sendError(res, err, "Errore durante l'invio degli aggiornamenti");
  }
}
