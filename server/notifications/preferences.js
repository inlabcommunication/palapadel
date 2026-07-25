import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { isValidInstallationId, normalizeTopicPrefs } from "../_lib/notifications.js";
import { notificationTopicsSchema, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const { installationId, topics, enabled, permission, timezone } = parseBody(z.object({
      installationId: z.string().regex(/^[a-zA-Z0-9_-]{16,96}$/),
      topics: notificationTopicsSchema,
      enabled: z.boolean(),
      permission: z.enum(["default", "granted", "denied"]),
      timezone: z.string().max(100).optional(),
    }).strict(), req.body);
    if (!isValidInstallationId(installationId)) throw new HttpError(400, "installationId non valido");

    const db = admin.firestore(getAdminApp());
    const now = new Date().toISOString();
    await db.doc(`notificationInstallations/${installationId}`).set(
      {
        installationId,
        notificationsEnabled: enabled !== false,
        topics: normalizeTopicPrefs(topics),
        permission: typeof permission === "string" ? permission : "default",
        timezone: typeof timezone === "string" ? timezone : null,
        updatedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore interno durante il salvataggio preferenze notifiche");
  }
}
