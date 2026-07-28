import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { parseBody, z } from "../_lib/validation.js";

const ANALYTICS_COLLECTIONS = ["analyticsEvents", "analyticsDaily", "analyticsInstallations"];

async function deleteCollection(db, collectionName) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(collectionName).limit(400).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
  }
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    parseBody(z.object({ confirmation: z.literal("RESET_ANALYTICS") }).strict(), req.body);
    const db = admin.firestore(app);

    const counts = {};
    for (const collectionName of ANALYTICS_COLLECTIONS) {
      counts[collectionName] = await deleteCollection(db, collectionName);
    }

    await db.collection("auditLog").add({
      actor: caller.uid,
      action: "analytics_reset",
      detail: JSON.stringify({ role: caller.role }),
      before: counts,
      after: { events: 0, aggregates: 0, installations: 0 },
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({ ok: true, deleted: counts });
  } catch (err) {
    sendError(res, err, "Errore durante il reset Analytics");
  }
}
