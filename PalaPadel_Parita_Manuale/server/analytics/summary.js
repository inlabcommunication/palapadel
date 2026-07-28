import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import {
  getAnalyticsActorRole,
  isCountedAnalyticsInstallation,
  shouldSkipAnalyticsRole,
} from "../_lib/analyticsPolicy.js";
import { parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    await verifyCaller(app, req, ["superAdmin"]);
    const db = admin.firestore(app);
    const { days } = parseBody(z.object({ days: z.number().int().min(1).max(90).default(30) }).strict(), req.body);

    const [dailySnap, installsSnap, recentEventsSnap, notificationSnap] = await Promise.all([
      db.collection("analyticsDaily").orderBy("day", "desc").limit(days).get(),
      db.collection("analyticsInstallations").get(),
      db.collection("analyticsEvents").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("notificationHistory").orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const daily = dailySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const recentEvents = recentEventsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((event) => !shouldSkipAnalyticsRole(getAnalyticsActorRole(event, event.properties)))
      .slice(0, 25);
    const notificationHistory = notificationSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const notificationTotals = notificationHistory.reduce(
      (acc, item) => {
        acc.sent += item.successCount ?? 0;
        acc.failed += item.failureCount ?? 0;
        if (item.status) acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
        return acc;
      },
      { sent: 0, failed: 0, byStatus: {} }
    );

    const totals = daily.reduce(
      (acc, day) => {
        acc.eventsTotal += day.eventsTotal ?? 0;
        acc.sessions += day.sessions ?? 0;
        acc.installs += day.installs ?? 0;
        acc.notificationPermissionGranted += day.notificationPermissionGranted ?? 0;
        acc.notificationPermissionDenied += day.notificationPermissionDenied ?? 0;
        return acc;
      },
      {
        devices: installsSnap.docs.filter((doc) => isCountedAnalyticsInstallation(doc.data())).length,
        eventsTotal: 0,
        sessions: 0,
        installs: 0,
        notificationPermissionGranted: 0,
        notificationPermissionDenied: 0,
      }
    );

    res.status(200).json({
      ok: true,
      totals,
      daily,
      recentEvents,
      notificationTotals,
    });
  } catch (err) {
    sendError(res, err, "Errore interno durante il riepilogo analytics");
  }
}
