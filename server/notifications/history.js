import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    await verifyCaller(app, req, ["superadmin"]);
    const limit = Math.min(Math.max(Number(req.body?.limit ?? 40), 1), 100);
    const snap = await admin.firestore(app).collection("notificationHistory").orderBy("createdAt", "desc").limit(limit).get();
    const history = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ ok: true, history });
  } catch (err) {
    sendError(res, err, "Errore interno durante la lettura storico notifiche");
  }
}
