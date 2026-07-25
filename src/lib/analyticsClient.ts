import { postToBackend } from "./backendClient";
import { getInstallationId } from "./installationId";
import { shouldTrackAnalyticsForRole, type AnalyticsRole } from "./analyticsPolicy";

export type AnalyticsEventType =
  | "session_start"
  | "page_view"
  | "pwa_installed"
  | "notification_permission"
  | "notification_subscribed"
  | "notification_received"
  | "notification_opened"
  | "share_standings";

export interface AnalyticsSummary {
  ok: true;
  totals: {
    devices: number;
    eventsTotal: number;
    sessions: number;
    installs: number;
    notificationPermissionGranted: number;
    notificationPermissionDenied: number;
  };
  daily: Array<Record<string, unknown> & { day: string }>;
  recentEvents: Array<Record<string, unknown> & { id: string; eventType: string; createdAt: string }>;
  notificationTotals: {
    sent: number;
    failed: number;
    byStatus: Record<string, number>;
  };
}

let analyticsReady = false;
let analyticsRole: AnalyticsRole = null;

export function configureAnalyticsContext(role: AnalyticsRole, ready: boolean) {
  analyticsRole = role ?? null;
  analyticsReady = ready;
}

export function canTrackAnalytics() {
  return shouldTrackAnalyticsForRole(analyticsRole, analyticsReady);
}

export function trackAnalyticsEvent(eventType: AnalyticsEventType, properties: Record<string, unknown> = {}) {
  if (!canTrackAnalytics()) return;

  const enrichedProperties = {
    ...properties,
    ...(analyticsRole ? { actorRole: analyticsRole } : {}),
  };
  const body = JSON.stringify({
    installationId: getInstallationId(),
    eventType,
    route: window.location.pathname,
    properties: enrichedProperties,
    actorRole: analyticsRole ?? null,
    userAgent: navigator.userAgent,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/track", blob)) return;
    }
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics interno: non deve mai disturbare il flusso dell'utente.
  }
}

export function getAnalyticsSummary(days = 30) {
  return postToBackend<AnalyticsSummary>("/api/analytics/summary", { days });
}
