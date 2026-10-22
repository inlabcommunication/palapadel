import { getAdminApp, admin } from "../../server/_lib/firebaseAdmin.js";
import { findOrphanStoragePaths, loadStorageReferences, MAX_AUTO_ORPHANS } from "../../server/_lib/storageOrphans.js";

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Non autorizzato" });
    return;
  }

  try {
    const app = getAdminApp();
    const db = admin.firestore(app);
    const bucket = admin.storage(app).bucket();
    const timestamp = new Date().toISOString();
    const [referenced, filesResult] = await Promise.all([loadStorageReferences(db), bucket.getFiles()]);
    const found = findOrphanStoragePaths(
      filesResult[0],
      referenced,
      ["home-news/", "teams/", "championship-types/"]
    );
    // Troppi file "orfani" in una volta: probabile errore nei riferimenti, non si
    // mette nulla in coda e si lascia traccia nel log per una verifica manuale.
    const aborted = found.length > MAX_AUTO_ORPHANS;
    const orphans = aborted ? [] : found;

    for (const path of orphans) {
      const id = Buffer.from(path).toString("base64url").slice(0, 500);
      await db.doc(`storageCleanupQueue/${id}`).set({
        storagePath: path,
        reason: "File orfano rilevato dal controllo periodico",
        status: "pending",
        updatedAt: timestamp,
        createdAt: timestamp,
        createdBy: "vercel-cron",
      }, { merge: true });
    }

    const queue = await db.collection("storageCleanupQueue").where("status", "in", ["pending", "failed"]).limit(100).get();
    let deleted = 0;
    let failed = 0;
    let skipped = 0;
    for (const itemDoc of queue.docs) {
      const item = itemDoc.data();
      // Ultimo controllo: un file tornato in uso non si cancella mai.
      if (referenced.has(item.storagePath)) {
        await itemDoc.ref.update({ status: "skipped", lastAttemptAt: timestamp, lastError: "File ancora in uso: non eliminato" });
        skipped += 1;
        continue;
      }
      try {
        await bucket.file(item.storagePath).delete({ ignoreNotFound: true });
        await itemDoc.ref.update({ status: "completed", completedAt: timestamp, lastError: null });
        deleted += 1;
      } catch (error) {
        await itemDoc.ref.update({
          status: "failed",
          attempts: Number(item.attempts ?? 0) + 1,
          lastAttemptAt: timestamp,
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Errore Storage",
        });
        failed += 1;
      }
    }
    await db.collection("auditLog").add({
      actor: "vercel-cron",
      action: "storage_cleanup_periodic",
      entity: "storageCleanupQueue",
      before: { queued: queue.size },
      after: { found: found.length, aborted, deleted, failed, skipped },
      detail: "Controllo periodico file orfani",
      timestamp,
    });
    res.status(200).json({ ok: true, found: found.length, aborted, deleted, failed, skipped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Pulizia periodica non riuscita" });
  }
}
