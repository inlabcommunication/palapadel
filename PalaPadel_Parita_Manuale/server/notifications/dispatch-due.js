import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { dispatchDueNotifications } from "../_lib/dispatchDueNotifications.js";
import { parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    parseBody(z.object({}).strict(), req.body);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const db = admin.firestore(app);
    const results = await dispatchDueNotifications(app, db, caller.uid);
    res.status(200).json({ ok: true, dispatched: results });
  } catch (err) {
    sendError(res, err, "Errore interno durante la lettura delle notifiche programmate");
  }
}
