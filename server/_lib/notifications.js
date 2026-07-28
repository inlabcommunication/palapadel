export const NOTIFICATION_TYPES = [
  "match_result",
  "standings_update",
  "correction",
  "winner",
  "news",
];

export const NOTIFICATION_MODES = ["disabled", "ask", "draft"];

export const DEFAULT_TYPE_MODES = {
  match_result: "draft",
  standings_update: "draft",
  correction: "ask",
  winner: "draft",
  news: "ask",
};

export function normalizeNotificationMode(value, fallback = "draft") {
  if (value === "automatic") return "draft";
  return NOTIFICATION_MODES.includes(value) ? value : fallback;
}

export function defaultNotificationSettings() {
  return {
    globalEnabled: false,
    typeModes: { ...DEFAULT_TYPE_MODES },
    editionModes: {},
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
  };
}

export function normalizeNotificationSettings(input = {}) {
  const defaults = defaultNotificationSettings();
  const typeModes = { ...defaults.typeModes };
  for (const type of NOTIFICATION_TYPES) {
    typeModes[type] = normalizeNotificationMode(input.typeModes?.[type], defaults.typeModes[type]);
  }

  const editionModes = {};
  for (const [editionId, modes] of Object.entries(input.editionModes ?? {})) {
    if (!editionId || typeof modes !== "object" || modes === null) continue;
    editionModes[editionId] = {};
    for (const type of NOTIFICATION_TYPES) {
      const normalized = normalizeNotificationMode(modes[type], "");
      if (normalized) editionModes[editionId][type] = normalized;
    }
  }

  const quietHours = {
    enabled: input.quietHours?.enabled === true,
    start: typeof input.quietHours?.start === "string" ? input.quietHours.start : defaults.quietHours.start,
    end: typeof input.quietHours?.end === "string" ? input.quietHours.end : defaults.quietHours.end,
  };

  return {
    globalEnabled: input.globalEnabled === true,
    typeModes,
    editionModes,
    quietHours,
  };
}

export function resolveNotificationMode(settings, eventType, editionId) {
  const normalized = normalizeNotificationSettings(settings);
  if (!normalized.globalEnabled) return "disabled";
  const editionMode = editionId ? normalized.editionModes?.[editionId]?.[eventType] : null;
  return normalizeNotificationMode(editionMode, normalized.typeModes[eventType] ?? "draft");
}

export function isValidInstallationId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,96}$/.test(value);
}

export function normalizeTopicPrefs(input = {}) {
  const prefs = {};
  for (const type of NOTIFICATION_TYPES) {
    prefs[type] = input[type] !== false;
  }
  return prefs;
}

export function buildNotificationPayload(event = {}) {
  const type = NOTIFICATION_TYPES.includes(event.type) ? event.type : "news";
  const title = String(event.title || "PalaPadel").trim().slice(0, 90);
  const body = String(event.body || "Nuovo aggiornamento disponibile.").trim().slice(0, 220);
  const url = String(event.url || "/notifiche").trim().slice(0, 300);
  const editionId = typeof event.editionId === "string" ? event.editionId : null;

  return {
    type,
    title,
    body,
    url,
    editionId,
    data: {
      type,
      editionId: editionId ?? "",
      url,
    },
  };
}
