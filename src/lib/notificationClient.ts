import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { app } from "../firebase";
import { postToBackend } from "./backendClient";
import { getInstallationId } from "./installationId";
import { trackAnalyticsEvent } from "./analyticsClient";

export const NOTIFICATION_TYPES = [
  "match_result",
  "standings_update",
  "correction",
  "winner",
  "news",
] as const;

export const NOTIFICATION_LABELS: Record<(typeof NOTIFICATION_TYPES)[number], string> = {
  match_result: "Risultati partite",
  standings_update: "Classifiche",
  correction: "Correzioni",
  winner: "Vincitori campionati",
  news: "PalaPadel News",
};

export const NOTIFICATION_MODE_LABELS = {
  disabled: "Disattivata",
  ask: "Chiedi",
  automatic: "Automatica",
  draft: "Bozza",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationMode = keyof typeof NOTIFICATION_MODE_LABELS;

export interface NotificationSettings {
  globalEnabled: boolean;
  typeModes: Record<NotificationType, NotificationMode>;
  editionModes: Record<string, Partial<Record<NotificationType, NotificationMode>>>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface NotificationHistoryEntry {
  id: string;
  eventType: NotificationType;
  status: string;
  createdAt?: string;
  sentAt?: string;
  scheduledAt?: string | null;
  successCount?: number;
  failureCount?: number;
  payload?: {
    title: string;
    body: string;
    url: string;
  };
}

export interface NotificationEventInput {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  editionId?: string | null;
}

export function defaultUserNotificationPrefs(): Record<NotificationType, boolean> {
  return {
    match_result: true,
    standings_update: true,
    correction: true,
    winner: true,
    news: true,
  };
}

export async function getNotificationSettings() {
  return postToBackend<{ ok: true; settings: NotificationSettings }>("/api/notifications/settings", {});
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  return postToBackend<{ ok: true; settings: NotificationSettings }>("/api/notifications/settings", { settings });
}

export async function saveNotificationPreferences(topics: Record<NotificationType, boolean>, enabled: boolean) {
  return fetch("/api/notifications/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId: getInstallationId(),
      topics,
      enabled,
      permission: "Notification" in window ? Notification.permission : "unsupported",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
}

export async function requestPushRegistration(topics: Record<NotificationType, boolean>) {
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" as const };
  const permission = await Notification.requestPermission();
  trackAnalyticsEvent("notification_permission", { permission });
  if (permission !== "granted") return { ok: false, reason: permission };

  const supported = await isSupported();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!supported || !vapidKey) return { ok: false, reason: "missing_config" as const };

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId: getInstallationId(),
      token,
      permission,
      topics,
      userAgent: navigator.userAgent,
      standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    }),
  });
  trackAnalyticsEvent("notification_subscribed");
  return { ok: true as const };
}

export async function bindForegroundNotificationTracking() {
  if (!(await isSupported())) return () => undefined;
  const messaging = getMessaging(app);
  return onMessage(messaging, () => {
    trackAnalyticsEvent("notification_received", { foreground: true });
  });
}

export function previewNotification(event: NotificationEventInput) {
  return postToBackend<{ ok: true; payload: NotificationEventInput; mode: NotificationMode }>("/api/notifications/preview", { event });
}

export function createNotificationDraft(event: NotificationEventInput, scheduledAt?: string | null) {
  return postToBackend<{ ok: true; draftId: string }>("/api/notifications/create-draft", { event, scheduledAt });
}

export function scheduleNotification(event: NotificationEventInput, scheduledAt: string) {
  return postToBackend<{ ok: true; draftId: string }>("/api/notifications/schedule", { event, scheduledAt });
}

export function sendNotification(event: NotificationEventInput) {
  return postToBackend<{ ok: true; status: string; successCount: number; failureCount: number }>("/api/notifications/send", {
    event,
    idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

export function getNotificationHistory() {
  return postToBackend<{ ok: true; history: NotificationHistoryEntry[] }>("/api/notifications/history", { limit: 50 });
}

export interface NotificationDiagnostics {
  status: string;
  firebaseAdmin: string;
  serverCredentials: string;
  vapidKey: string;
  serviceWorker: string;
  endpoint: string;
  settings: string;
  registeredDevices: number;
  enabledDevices: number;
  validTokens: number;
  recentFailures: number;
  recentSuccesses: number;
  message: string | null;
}

export function getNotificationDiagnostics() {
  return postToBackend<{ ok: true; diagnostics: NotificationDiagnostics }>("/api/notifications/diagnostics", {});
}

export function notifyNotificationEvent(event: NotificationEventInput, idempotencyKey: string, sourceRef?: string) {
  return postToBackend<{ ok: true; notification: unknown }>("/api/notifications/event", {
    event,
    idempotencyKey,
    sourceRef,
  });
}
