import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { getAnalyticsActorRole, shouldSkipAnalyticsRole } from "../_lib/analyticsPolicy.js";
import { isValidInstallationId } from "../_lib/notifications.js";

const ALLOWED_EVENTS = new Set([
  "session_start",
  "page_view",
  "pwa_installed",
  "notification_permission",
  "notification_subscribed",
  "notification_received",
  "notification_opened",
  "share_standings",
]);

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const body = req.body || {};
    const { installationId, eventType, route, properties, userAgent, standalone, notificationPermission } = body;
    if (!isValidInstallationId(installationId)) throw new HttpError(400, "installationId non valido");
    if (!ALLOWED_EVENTS.has(eventType)) throw new HttpError(400, "eventType non valido");

    const cleanProperties = properties && typeof properties === "object" ? properties : {};
    const actorRole = getAnalyticsActorRole(body, cleanProperties);
    const db = admin.firestore(getAdminApp());
    const now = new Date();
    const timestamp = now.toISOString();
    if (shouldSkipAnalyticsRole(actorRole)) {
      await db.doc(`analyticsInstallations/${installationId}`).set(
        {
          installationId,
          actorRole,
          excludedFromAnalytics: true,
          lastExcludedAt: timestamp,
        },
        { merge: true }
      );
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const day = todayKey(now);
    const eventRef = db.collection("analyticsEvents").doc();
    const installRef = db.doc(`analyticsInstallations/${installationId}`);
    const dailyRef = db.doc(`analyticsDaily/${day}`);

    const event = {
      id: eventRef.id,
      installationId,
      eventType,
      route: typeof route === "string" ? route.slice(0, 160) : null,
      properties: cleanProperties,
      actorRole,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 240) : null,
      standalone: standalone === true,
      notificationPermission: typeof notificationPermission === "string" ? notificationPermission : null,
      createdAt: timestamp,
      day,
    };

    const increments = {
      eventsTotal: admin.firestore.FieldValue.increment(1),
      [`events.${eventType}`]: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    };
    if (eventType === "session_start") increments.sessions = admin.firestore.FieldValue.increment(1);
    if (eventType === "pwa_installed") increments.installs = admin.firestore.FieldValue.increment(1);
    if (eventType === "notification_permission" && cleanProperties.permission === "granted") {
      increments.notificationPermissionGranted = admin.firestore.FieldValue.increment(1);
    }
    if (eventType === "notification_permission" && cleanProperties.permission === "denied") {
      increments.notificationPermissionDenied = admin.firestore.FieldValue.increment(1);
    }

    const installSnap = await installRef.get();
    const installData = {
      installationId,
      lastSeenAt: timestamp,
      lastRoute: event.route,
      userAgent: event.userAgent,
      standalone: event.standalone,
      notificationPermission: event.notificationPermission,
      actorRole,
      excludedFromAnalytics: false,
    };
    if (!installSnap.exists) installData.firstSeenAt = timestamp;

    await Promise.all([
      eventRef.set(event),
      installRef.set(installData, { merge: true }),
      dailyRef.set({ day, ...increments }, { merge: true }),
    ]);

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore interno durante il tracking analytics");
  }
}
