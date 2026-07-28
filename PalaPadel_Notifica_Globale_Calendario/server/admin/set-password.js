import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const schema = z.object({
  targetUid: documentId,
  newPassword: z.string().min(6).max(128),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { targetUid, newPassword } = parseBody(schema, req.body);
    await admin.auth(app).updateUser(targetUid, { password: newPassword });
    await admin.firestore(app).collection("auditLog").add({
      actor: caller.uid,
      action: "user_password_changed",
      entity: `users/${targetUid}`,
      before: null,
      after: null,
      detail: JSON.stringify({ role: caller.role }),
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore durante l'aggiornamento della password");
  }
}
