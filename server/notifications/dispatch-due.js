import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { dispatchNotification } from "../_lib/notificationDispatch.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superadmin"]);
    const now = new Date().toISOString();
    const db = admin.firestore(app);
    const [queuedSnap, scheduledSnap] = await Promise.all([
      db.collection("notificationDrafts").where("status", "==", "queued").limit(25).get(),
      db.collection("notificationDrafts").where("status", "==", "scheduled").where("scheduledAt", "<=", now).limit(25).get(),
    ]);
    const docs = [...queuedSnap.docs, ...scheduledSnap.docs];
    const results = [];
    for (const doc of docs) {
      const draft = doc.data();
      const result = await dispatchNotification(app, db, draft.payload, caller.uid, {
        draftRef: doc.ref,
        idempotencyKey: `due-${doc.id}`,
      });
      results.push({ draftId: doc.id, status: result.status, successCount: result.successCount, failureCount: result.failureCount });
    }
    res.status(200).json({ ok: true, dispatched: results });
  } catch (err) {
    sendError(res, err, "Errore interno durante la lettura delle notifiche programmate");
  }
}
