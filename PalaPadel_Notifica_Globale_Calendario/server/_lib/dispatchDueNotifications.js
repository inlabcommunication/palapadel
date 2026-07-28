import { dispatchNotification } from "./notificationDispatch.js";

export async function dispatchDueNotifications(app, db, callerUid, limit = 25) {
  const now = new Date().toISOString();
  const [queuedSnap, scheduledSnap] = await Promise.all([
    db.collection("notificationDrafts").where("status", "==", "queued").limit(limit).get(),
    db.collection("notificationDrafts").where("status", "==", "scheduled").where("scheduledAt", "<=", now).limit(limit).get(),
  ]);
  const docs = [...new Map(
    [...queuedSnap.docs, ...scheduledSnap.docs].map((doc) => [doc.id, doc])
  ).values()];
  const results = [];

  for (const doc of docs) {
    const draft = doc.data();
    const result = await dispatchNotification(app, db, draft.payload, callerUid, {
      draftRef: doc.ref,
      idempotencyKey: `due-${doc.id}`,
    });
    results.push({
      draftId: doc.id,
      status: result.status,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  }

  return results;
}
