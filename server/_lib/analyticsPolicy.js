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
