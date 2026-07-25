import crypto from "node:crypto";
import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { isValidInstallationId, normalizeTopicPrefs } from "../_lib/notifications.js";

function tokenId(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const { installationId, token, permission, topics, userAgent, standalone } = req.body || {};
    if (!isValidInstallationId(installationId)) throw new HttpError(400, "installationId non valido");
    if (!token || typeof token !== "string" || token.length < 40) throw new HttpError(400, "Token push non valido");

    const db = admin.firestore(getAdminApp());
    const now = new Date().toISOString();
    const installRef = db.doc(`notificationInstallations/${installationId}`);
    await installRef.set(
      {
        installationId,
        notificationsEnabled: permission === "granted",
        topics: normalizeTopicPrefs(topics),
        permission: typeof permission === "string" ? permission : "default",
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 240) : null,
        standalone: standalone === true,
        lastTokenAt: now,
        updatedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await installRef.collection("tokens").doc(tokenId(token)).set(
      {
        token,
        active: true,
        permission: typeof permission === "string" ? permission : "default",
        updatedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore interno durante l'iscrizione push");
  }
}
