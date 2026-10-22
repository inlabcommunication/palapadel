import { test } from "node:test";
import assert from "node:assert/strict";
import { isAnalyticsExcludedRole, shouldTrackAnalyticsForRole } from "../src/lib/analyticsPolicy.ts";
import {
  getAnalyticsActorRole,
  isCountedAnalyticsInstallation,
  normalizeAnalyticsRole,
  shouldSkipAnalyticsRole,
} from "../server/_lib/analyticsPolicy.js";

test("client analytics policy excludes admin and superadmin", () => {
  assert.equal(isAnalyticsExcludedRole("admin"), true);
  assert.equal(isAnalyticsExcludedRole("superadmin"), true);
  assert.equal(isAnalyticsExcludedRole("superAdmin"), true);
  assert.equal(shouldTrackAnalyticsForRole("admin", true), false);
  assert.equal(shouldTrackAnalyticsForRole("superadmin", true), false);
  assert.equal(shouldTrackAnalyticsForRole("superAdmin", true), false);
  assert.equal(shouldTrackAnalyticsForRole("resultManager", true), true);
  assert.equal(shouldTrackAnalyticsForRole(null, true), true);
  assert.equal(shouldTrackAnalyticsForRole(null, false), false);
});

test("server analytics policy skips staff roles from body or properties", () => {
  assert.equal(normalizeAnalyticsRole(" SuperAdmin "), "superadmin");
  assert.equal(shouldSkipAnalyticsRole("admin"), true);
  assert.equal(shouldSkipAnalyticsRole("superadmin"), true);
  assert.equal(shouldSkipAnalyticsRole("gestore"), false);
  assert.equal(getAnalyticsActorRole({ actorRole: "admin" }, {}), "admin");
  assert.equal(getAnalyticsActorRole({}, { actorRole: "superadmin" }), "superadmin");
  assert.equal(isCountedAnalyticsInstallation({ actorRole: "admin" }), false);
  assert.equal(isCountedAnalyticsInstallation({ excludedFromAnalytics: true }), false);
  assert.equal(isCountedAnalyticsInstallation({ actorRole: "gestore" }), true);
});

test("dispositivi: attivi e nuovi nel periodo, totale da sempre, staff escluso", async () => {
  const { countAnalyticsDevices } = await import("../server/_lib/analyticsPolicy.js");
  const now = Date.parse("2026-10-22T12:00:00.000Z");
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
  const installs = [
    { firstSeenAt: daysAgo(2), lastSeenAt: daysAgo(1) },
    { firstSeenAt: daysAgo(60), lastSeenAt: daysAgo(3) },
    { firstSeenAt: daysAgo(90), lastSeenAt: daysAgo(45) },
    { firstSeenAt: daysAgo(1), lastSeenAt: daysAgo(1), excludedFromAnalytics: true },
    { firstSeenAt: daysAgo(1), lastSeenAt: daysAgo(1), actorRole: "superadmin" },
    { lastSeenAt: "data non valida" },
  ];
  assert.deepEqual(countAnalyticsDevices(installs, 30, now), { active: 2, new: 1, total: 4 });
});
