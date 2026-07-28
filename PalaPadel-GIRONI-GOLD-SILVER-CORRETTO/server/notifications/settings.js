import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { defaultNotificationSettings, normalizeNotificationSettings } from "../_lib/notifications.js";
import { notificationMode, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const db = admin.firestore(app);
    const ref = db.doc("notificationSettings/global");

    const input = parseBody(z.union([
      z.object({}).strict(),
      z.object({ settings: z.object({
        globalEnabled: z.boolean(),
        typeModes: z.record(z.string(), notificationMode),
        editionModes: z.record(z.string(), z.record(z.string(), notificationMode)),
        quietHours: z.object({
          enabled: z.boolean(),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }).strict(),
      }).strict() }).strict(),
    ]), req.body);
    if ("settings" in input) {
      const settings = normalizeNotificationSettings(input.settings);
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
