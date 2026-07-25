import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { parseBody, z } from "../_lib/validation.js";

const schema = z.object({
  publicNoticeEnabled: z.boolean(),
  publicNotice: z.string().trim().max(300),
  inlabLogoUrl: z.string().url().nullable().optional(),
  inlabLogoStoragePath: z.string().min(1).nullable().optional(),
  inlabLogoAlt: z.string().trim().max(150).nullable().optional(),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const ref = db.doc("publicSettings/global");
    const previous = await ref.get();
    const after = {
      publicNoticeEnabled: input.publicNoticeEnabled,
      publicNotice: input.publicNotice,
      updatedAt: new Date().toISOString(),
      updatedBy: caller.uid,
    };
    if (input.inlabLogoUrl !== undefined) after.inlabLogoUrl = input.inlabLogoUrl === null ? admin.firestore.FieldValue.delete() : input.inlabLogoUrl;
    if (input.inlabLogoStoragePath !== undefined) after.inlabLogoStoragePath = input.inlabLogoStoragePath === null ? admin.firestore.FieldValue.delete() : input.inlabLogoStoragePath;
    if (input.inlabLogoAlt !== undefined) after.inlabLogoAlt = input.inlabLogoAlt === null ? admin.firestore.FieldValue.delete() : input.inlabLogoAlt;
    const batch = db.batch();
    batch.set(ref, after, { merge: true });
    batch.set(db.collection("auditLog").doc(), {
      actor: caller.uid,
      action: "public_settings_updated",
      entity: "publicSettings/global",
      before: previous.exists ? previous.data() : null,
      after,
      detail: JSON.stringify({ role: caller.role }),
      timestamp: after.updatedAt,
    });
    await batch.commit();
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore nel salvataggio delle impostazioni pubbliche");
  }
}
