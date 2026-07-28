import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { classifyNotificationChanges } from "../_lib/contextNotifications.js";
import { hasPermission, PERMISSIONS } from "../../shared/permissions.js";
import { parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    parseBody(z.object({}).strict(), req.body);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req);
    if (!hasPermission(caller.role, PERMISSIONS.SEND_NOTIFICATIONS)) {
      throw new HttpError(403, "Permessi insufficienti");
    }

    const db = admin.firestore(app);
    const stateSnap = await db.doc("notificationSettings/manualContextState").get();
    const fallback = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since = stateSnap.exists && typeof stateSnap.data().lastSentAt === "string"
      ? stateSnap.data().lastSentAt
      : fallback;
    const auditSnap = await db.collection("auditLog").where("timestamp", ">", since).orderBy("timestamp", "asc").limit(500).get();
    const detected = classifyNotificationChanges(auditSnap.docs.map((doc) => doc.data()));

    res.status(200).json({ ok: true, since, detected, changesCount: auditSnap.size });
  } catch (err) {
    sendError(res, err, "Errore durante il rilevamento degli aggiornamenti");
  }
}
