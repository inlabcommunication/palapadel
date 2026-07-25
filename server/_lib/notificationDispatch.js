import { admin } from "./firebaseAdmin.js";
import { normalizeTopicPrefs } from "./notifications.js";

export async function collectTargetTokens(db, payload) {
  const snap = await db.collectionGroup("tokens").where("active", "==", true).get();
  const targets = [];
  for (const tokenDoc of snap.docs) {
    const installRef = tokenDoc.ref.parent.parent;
    if (!installRef) continue;
    const installSnap = await installRef.get();
    const install = installSnap.exists ? installSnap.data() : {};
    if (install.notificationsEnabled === false || install.permission !== "granted") continue;
    const topics = normalizeTopicPrefs(install.topics);
    if (topics[payload.type] === false) continue;
    targets.push(tokenDoc.data().token);
  }
  return [...new Set(targets)];
}

export async function dispatchNotification(app, db, payload, callerUid, options = {}) {
  const { draftRef = null, idempotencyKey = null } = options;

  if (idempotencyKey) {
    const dispatchSnap = await db.doc(`notificationDispatches/${idempotencyKey}`).get();
    if (dispatchSnap.exists) return { ...dispatchSnap.data(), idempotent: true };
  }

  const tokens = await collectTargetTokens(db, payload);
  const now = new Date().toISOString();
  let status = "sent";
  let successCount = 0;
  let failureCount = 0;
  let providerError = null;

  if (tokens.length > 0) {
    try {
      const response = await admin.messaging(app).sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        webpush: { fcmOptions: { link: payload.url } },
      });
      successCount = response.successCount;
      failureCount = response.failureCount;
      status = failureCount > 0 && successCount === 0 ? "failed" : "sent";
    } catch (err) {
      status = "failed";
      failureCount = tokens.length;
      providerError = err.message;
    }
  } else {
    status = "skipped";
  }

  const historyRef = db.collection("notificationHistory").doc();
  const result = {
    historyId: historyRef.id,
    payload,
    eventType: payload.type,
    editionId: payload.editionId,
    status,
    attemptedCount: tokens.length,
    successCount,
    failureCount,
    providerError,
    createdAt: now,
    sentAt: now,
    sentBy: callerUid,
  };
  await historyRef.set(result);

  if (draftRef) {
    await draftRef.set({ status, sentAt: now, updatedAt: now, historyId: historyRef.id }, { merge: true });
  }
  if (idempotencyKey) {
    await db.doc(`notificationDispatches/${idempotencyKey}`).set(result);
  }

  return result;
}
