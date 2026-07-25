import { getAdminApp, admin } from "../../server/_lib/firebaseAdmin.js";

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
    const [newsSnap, teamsSnap, filesResult] = await Promise.all([
      db.collection("homeNews").get(),
      db.collection("teams").get(),
      bucket.getFiles(),
    ]);
    const referenced = new Set([
      ...newsSnap.docs.map((doc) => doc.data().imageStoragePath).filter(Boolean),
      ...teamsSnap.docs.map((doc) => doc.data().teamPhotoStoragePath).filter(Boolean),
    ]);
    const orphans = filesResult[0]
      .map((file) => file.name)
      .filter((path) => (path.startsWith("home-news/") || path.startsWith("teams/")) && !referenced.has(path))
      .slice(0, 400);

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
    for (const itemDoc of queue.docs) {
      const item = itemDoc.data();
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
      after: { found: orphans.length, deleted, failed },
      detail: "Controllo periodico file orfani",
      timestamp,
    });
    res.status(200).json({ ok: true, found: orphans.length, deleted, failed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Pulizia periodica non riuscita" });
  }
}
