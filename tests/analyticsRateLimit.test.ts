import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkInstallationRate,
  createIpRateLimiter,
  getClientIp,
  getDailyEventLimit,
  INSTALLATION_EVENTS_PER_DAY,
  INSTALLATION_EVENTS_PER_MINUTE,
  isDailyLimitReached,
} from "../server/_lib/analyticsRateLimit.js";

const now = new Date("2026-10-21T10:15:30.000Z");

test("installation rate starts counters for a new device", () => {
  assert.deepEqual(checkInstallationRate(null, now), {
    allowed: true,
    fields: { rateMinute: "2026-10-21T10:15", rateMinuteCount: 1, rateDay: "2026-10-21", rateDayCount: 1 },
  });
});

test("installation rate blocks too many events in the same minute and resets next minute", () => {
  const data = { rateMinute: "2026-10-21T10:15", rateMinuteCount: INSTALLATION_EVENTS_PER_MINUTE, rateDay: "2026-10-21", rateDayCount: 40 };
  assert.equal(checkInstallationRate(data, now).allowed, false);
  const next = checkInstallationRate(data, new Date("2026-10-21T10:16:01.000Z"));
  assert.equal(next.allowed, true);
  assert.equal(next.fields?.rateMinuteCount, 1);
  assert.equal(next.fields?.rateDayCount, 41);
});

test("installation rate blocks a device over the daily limit until the next day", () => {
  const data = { rateMinute: "2026-10-21T09:00", rateMinuteCount: 1, rateDay: "2026-10-21", rateDayCount: INSTALLATION_EVENTS_PER_DAY };
  assert.equal(checkInstallationRate(data, now).allowed, false);
  assert.equal(checkInstallationRate(data, new Date("2026-10-22T00:00:01.000Z")).allowed, true);
});

test("daily global limit uses env override and stops at the cap", () => {
  assert.equal(getDailyEventLimit({}), 3000);
  assert.equal(getDailyEventLimit({ ANALYTICS_DAILY_EVENT_LIMIT: "500" }), 500);
  assert.equal(getDailyEventLimit({ ANALYTICS_DAILY_EVENT_LIMIT: "abc" }), 3000);
  assert.equal(isDailyLimitReached({ eventsTotal: 499 }, 500), false);
  assert.equal(isDailyLimitReached({ eventsTotal: 500 }, 500), true);
  assert.equal(isDailyLimitReached(null, 500), false);
});

test("ip limiter allows bursts up to the limit per minute", () => {
  const allow = createIpRateLimiter(2);
  assert.equal(allow("1.1.1.1", 0), true);
  assert.equal(allow("1.1.1.1", 1000), true);
  assert.equal(allow("1.1.1.1", 2000), false);
  assert.equal(allow("2.2.2.2", 2000), true);
  assert.equal(allow("1.1.1.1", 61000), true);
});

test("client ip comes from the first forwarded address", () => {
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }), "9.9.9.9");
  assert.equal(getClientIp({ headers: {} }), "");
});
