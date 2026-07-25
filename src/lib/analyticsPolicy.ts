export type AnalyticsRole = string | null | undefined;

export function isAnalyticsExcludedRole(role: AnalyticsRole) {
  return role === "admin" || role === "superadmin";
}

export function shouldTrackAnalyticsForRole(role: AnalyticsRole, ready: boolean) {
  return ready && !isAnalyticsExcludedRole(role);
}
