import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { parseBody, z } from "../_lib/validation.js";
import { findOrphanStoragePaths, loadStorageReferences } from "../_lib/storageOrphans.js";

const storagePath = z.string().trim().min(3).max(1000).refine(
  (path) => path.startsWith("home-news/") || path.startsWith("teams/") || path.startsWith("championship-types/") || path.startsWith("tournaments/"),
  "Percorso Storage non consentito"
);
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("enqueue"), storagePath, reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ operation: z.literal("process") }).strict(),
  z.object({ operation: z.literal("scan") }).strict(),
]);

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const bucket = admin.storage(app).bucket();
    const timestamp = new Date().toISOString();

    if (input.operation === "enqueue") {
      await enqueue(db, input.storagePath, input.reason, caller.uid, timestamp);
      res.status(200).json({ ok: true, queued: 1 });
      return;
    }

    if (input.operation === "scan") {
      const [referenced, filesResult] = await Promise.all([loadStorageReferences(db), bucket.getFiles()]);
      const orphanPaths = findOrphanStoragePaths(
        filesResult[0],
        referenced,
        ["home-news/", "teams/", "championship-types/", "tournaments/"]
      );
      for (const path of orphanPaths.slice(0, 400)) {
        await enqueue(db, path, "File orfano rilevato dalla scansione periodica", caller.uid, timestamp);
      }
      res.status(200).json({ ok: true, queued: orphanPaths.length });
      return;
    }

    const [queueSnap, referenced] = await Promise.all([
      db.collection("storageCleanupQueue").where("status", "in", ["pending", "failed"]).limit(100).get(),
      loadStorageReferences(db),
    ]);
    let deleted = 0;
    let failed = 0;
    let skipped = 0;
    for (const doc of queueSnap.docs) {
      const item = doc.data();
      // Un file ancora citato da un documento non si cancella mai.
      if (referenced.has(item.storagePath)) {
        await doc.ref.update({ status: "skipped", lastAttemptAt: new Date().toISOString(), lastError: "File ancora in uso: non eliminato" });
        skipped += 1;
        continue;
      }
      try {
        await bucket.file(item.storagePath).delete({ ignoreNotFound: true });
        await doc.ref.update({ status: "completed", completedAt: new Date().toISOString(), lastError: null });
        deleted += 1;
      } catch (err) {
        await doc.ref.update({
          status: "failed",
          attempts: Number(item.attempts ?? 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: err instanceof Error ? err.message.slice(0, 500) : "Errore Storage",
        });
        failed += 1;
      }
    }
    await db.collection("auditLog").add({
      actor: caller.uid,
      action: "storage_cleanup_processed",
      entity: "storageCleanupQueue",
      detail: JSON.stringify({ role: caller.role }),
      before: { queued: queueSnap.size },
      after: { deleted, failed, skipped },
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({ ok: true, deleted, failed, skipped });
  } catch (err) {
    sendError(res, err, "Errore durante la pulizia Storage");
  }
}

async function enqueue(db, path, reason, actor, timestamp) {
  const id = Buffer.from(path).toString("base64url").slice(0, 500);
  const ref = db.doc(`storageCleanupQueue/${id}`);
  const existing = await ref.get();
  if (existing.exists && existing.data().status === "completed") return;
  await ref.set({
    storagePath: path,
    reason,
    status: "pending",
    attempts: existing.exists ? Number(existing.data().attempts ?? 0) : 0,
    createdAt: existing.exists ? existing.data().createdAt : timestamp,
    updatedAt: timestamp,
    createdBy: actor,
  }, { merge: true });
}
