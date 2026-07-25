import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const draftId = typeof req.body?.draftId === "string" ? req.body.draftId : "";
    if (!draftId) throw new HttpError(400, "draftId mancante");

    const now = new Date().toISOString();
    const db = admin.firestore(app);
    await db.doc(`notificationDrafts/${draftId}`).set(
      { status: "cancelled", cancelledAt: now, cancelledBy: caller.uid, updatedAt: now },
      { merge: true }
    );
    await db.doc(`notificationHistory/${draftId}`).set(
      { status: "cancelled", cancelledAt: now, cancelledBy: caller.uid, updatedAt: now },
      { merge: true }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore interno durante l'annullamento notifica");
  }
}
