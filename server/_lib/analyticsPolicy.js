const EXCLUDED_ANALYTICS_ROLES = new Set(["admin", "superadmin", "superAdmin"]);

export function normalizeAnalyticsRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : null;
}

export function shouldSkipAnalyticsRole(role) {
  const normalizedRole = normalizeAnalyticsRole(role);
  return normalizedRole ? EXCLUDED_ANALYTICS_ROLES.has(normalizedRole) : false;
}

export function getAnalyticsActorRole(body, properties) {
  return normalizeAnalyticsRole(body?.actorRole ?? properties?.actorRole ?? body?.role ?? properties?.role);
}

export function isCountedAnalyticsInstallation(data) {
  return data?.excludedFromAnalytics !== true && !shouldSkipAnalyticsRole(data?.actorRole ?? data?.role);
}

/**
 * Conteggio dispositivi (in realtà browser: lo stesso telefono può contare più volte).
 * active: visti nel periodo; new: visti per la prima volta nel periodo; total: da sempre.
 */
export function countAnalyticsDevices(installations, days, now = Date.now()) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const counted = installations.filter(isCountedAnalyticsInstallation);
  const inPeriod = (value) => {
    const time = Date.parse(value ?? "");
    return Number.isFinite(time) && time >= cutoff;
  };
  return {
    active: counted.filter((item) => inPeriod(item.lastSeenAt)).length,
    new: counted.filter((item) => inPeriod(item.firstSeenAt)).length,
    total: counted.length,
  };
}
