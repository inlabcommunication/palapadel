import { admin } from "./firebaseAdmin.js";
import {
  buildNotificationPayload,
  defaultNotificationSettings,
  resolveNotificationMode,
} from "./notifications.js";

export async function enqueueNotificationEvent(app, event, options = {}) {
  const db = admin.firestore(app);
  const payload = buildNotificationPayload(event);
  const settingsSnap = await db.doc("notificationSettings/global").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : defaultNotificationSettings();
  const mode = resolveNotificationMode(settings, payload.type, payload.editionId);
  if (mode === "disabled") return { mode, status: "none", payload };

  const now = new Date().toISOString();
  const id = options.idempotencyKey || db.collection("notificationDrafts").doc().id;
  const draftRef = db.doc(`notificationDrafts/${id}`);
  const draftStatus = "draft";
  await draftRef.set(
    {
      id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      mode,
      status: draftStatus,
      sourceRef: options.sourceRef ?? null,
      createdAt: now,
      createdBy: options.createdBy ?? null,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.collection("notificationHistory").doc(id).set(
    {
      id,
      payload,
      eventType: payload.type,
      editionId: payload.editionId,
      mode,
      status: draftStatus,
      sourceRef: options.sourceRef ?? null,
      createdAt: now,
      createdBy: options.createdBy ?? null,
      successCount: 0,
      failureCount: 0,
    },
    { merge: true }
  );

  return { mode, status: draftStatus, payload, draftId: id };
}
