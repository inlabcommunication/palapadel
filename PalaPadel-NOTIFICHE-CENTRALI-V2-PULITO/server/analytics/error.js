import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { parseBody, z } from "../_lib/validation.js";
import { requirePost, sendError } from "../_lib/auth.js";

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  source: z.string().trim().max(200).optional(),
  path: z.string().trim().max(300),
  userAgent: z.string().trim().max(240).optional(),
  release: z.string().trim().max(100).optional(),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(getAdminApp());
    await db.collection("productionErrors").add({
      ...input,
      createdAt: new Date().toISOString(),
      resolved: false,
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Registrazione errore non riuscita");
  }
}
