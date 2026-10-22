import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { getAnalyticsActorRole, shouldSkipAnalyticsRole } from "../_lib/analyticsPolicy.js";
import { isValidInstallationId } from "../_lib/notifications.js";
import { parseBody, z } from "../_lib/validation.js";
import {
  checkInstallationRate,
  createIpRateLimiter,
  getClientIp,
  getDailyEventLimit,
  isDailyLimitReached,
} from "../_lib/analyticsRateLimit.js";

const allowIp = createIpRateLimiter();

// Proprietà piatte e brevi: niente oggetti annidati o testi lunghi salvati in Firestore.
const propertiesSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 12, "Troppe proprietà");

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
    if (!allowIp(getClientIp(req))) throw new HttpError(429, "Troppe richieste");
    const body = parseBody(z.object({
      installationId: z.string().regex(/^[a-zA-Z0-9_-]{16,96}$/),
      eventType: z.enum(["session_start", "page_view", "pwa_installed", "notification_permission", "notification_subscribed", "notification_received", "notification_opened", "share_standings"]),
      route: z.string().max(160).nullable().optional(),
      properties: propertiesSchema.optional(),
      userAgent: z.string().max(240).optional(),
      standalone: z.boolean().optional(),
      notificationPermission: z.enum(["default", "granted", "denied", "unsupported"]).optional(),
      actorRole: z.enum(["superAdmin", "admin", "resultManager"]).nullable().optional(),
    }).strict(), req.body);
    const { installationId, eventType, route, properties, userAgent, standalone, notificationPermission } = body;
    if (!isValidInstallationId(installationId)) throw new HttpError(400, "installationId non valido");
    if (!ALLOWED_EVENTS.has(eventType)) throw new HttpError(400, "eventType non valido");

    const cleanProperties = properties && typeof properties === "object" ? properties : {};
    // Il ruolo è dichiarato dal browser e non è verificabile (sendBeacon non porta il
    // token): serve solo a escludere lo staff. Se arriva un ruolo escluso non si scrive
    // nulla, così una dichiarazione falsa non può alterare né gonfiare i dati.
    const actorRole = getAnalyticsActorRole(body, cleanProperties);
    if (shouldSkipAnalyticsRole(actorRole)) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const db = admin.firestore(getAdminApp());
    const now = new Date();
    const timestamp = now.toISOString();
    const day = todayKey(now);
    const eventRef = db.collection("analyticsEvents").doc();
    const installRef = db.doc(`analyticsInstallations/${installationId}`);
    const dailyRef = db.doc(`analyticsDaily/${day}`);

    const [installSnap, dailySnap] = await Promise.all([installRef.get(), dailyRef.get()]);
    const rate = checkInstallationRate(installSnap.exists ? installSnap.data() : null, now);
    if (!rate.allowed || isDailyLimitReached(dailySnap.exists ? dailySnap.data() : null, getDailyEventLimit())) {
      throw new HttpError(429, "Limite eventi analytics raggiunto");
    }

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

    const installData = {
      ...rate.fields,
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
