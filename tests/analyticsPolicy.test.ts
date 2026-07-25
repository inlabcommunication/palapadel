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
  assert.equal(shouldTrackAnalyticsForRole("admin", true), false);
  assert.equal(shouldTrackAnalyticsForRole("superadmin", true), false);
  assert.equal(shouldTrackAnalyticsForRole("gestore", true), true);
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
