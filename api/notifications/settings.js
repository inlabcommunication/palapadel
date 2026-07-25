import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { defaultNotificationSettings, normalizeNotificationSettings } from "../_lib/notifications.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const db = admin.firestore(app);
    const ref = db.doc("notificationSettings/global");

    if (req.body?.settings) {
      const settings = normalizeNotificationSettings(req.body.settings);
      await ref.set(
        {
          ...settings,
          updatedAt: new Date().toISOString(),
          updatedBy: caller.uid,
        },
        { merge: true }
      );
      res.status(200).json({ ok: true, settings });
      return;
    }

    const snap = await ref.get();
    const settings = snap.exists ? normalizeNotificationSettings(snap.data()) : defaultNotificationSettings();
    res.status(200).json({ ok: true, settings });
  } catch (err) {
    sendError(res, err, "Errore interno durante la lettura delle impostazioni notifiche");
  }
}
