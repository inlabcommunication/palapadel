import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { buildNotificationPayload, defaultNotificationSettings, resolveNotificationMode } from "../_lib/notifications.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    await verifyCaller(app, req, ["superadmin"]);

    const payload = buildNotificationPayload(req.body?.event);
    const settingsSnap = await admin.firestore(app).doc("notificationSettings/global").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : defaultNotificationSettings();
    const mode = resolveNotificationMode(settings, payload.type, payload.editionId);

    res.status(200).json({ ok: true, payload, mode });
  } catch (err) {
    sendError(res, err, "Errore interno durante l'anteprima notifica");
  }
}
