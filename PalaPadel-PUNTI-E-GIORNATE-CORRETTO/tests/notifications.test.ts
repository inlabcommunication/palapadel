import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationPayload,
  isValidInstallationId,
  normalizeNotificationSettings,
  resolveNotificationMode,
} from "../server/_lib/notifications.js";
import { classifyNotificationChanges } from "../server/_lib/contextNotifications.js";

test("normalizeNotificationSettings conserva solo modalita valide e completa i default", () => {
  const settings = normalizeNotificationSettings({
    globalEnabled: true,
    typeModes: { match_result: "automatic", news: "banana" },
  });

  assert.equal(settings.globalEnabled, true);
  assert.equal(settings.typeModes.match_result, "draft");
  assert.equal(settings.typeModes.news, "ask");
  assert.equal(settings.typeModes.winner, "draft");
});

test("resolveNotificationMode applica override per edizione e switch globale", () => {
  const settings = normalizeNotificationSettings({
    globalEnabled: true,
    typeModes: { match_result: "draft" },
    editionModes: { ed1: { match_result: "automatic" } },
  });

  assert.equal(resolveNotificationMode(settings, "match_result", "ed1"), "draft");
  assert.equal(resolveNotificationMode(settings, "match_result", "ed2"), "draft");
  assert.equal(resolveNotificationMode({ ...settings, globalEnabled: false }, "match_result", "ed1"), "disabled");
});

test("buildNotificationPayload tronca e normalizza un evento notifica", () => {
  const payload = buildNotificationPayload({
    type: "match_result",
    title: "  Risultato aggiornato  ",
    body: "Partita conclusa",
    url: "/campionati/ed1",
    editionId: "ed1",
  });

  assert.equal(payload.type, "match_result");
  assert.equal(payload.title, "Risultato aggiornato");
  assert.equal(payload.data.editionId, "ed1");
});

test("isValidInstallationId accetta solo identificativi locali non banali", () => {
  assert.equal(isValidInstallationId("abc"), false);
  assert.equal(isValidInstallationId("installazione_1234567890"), true);
});

test("il riepilogo notifiche riconosce classifica calendario e news dall'audit log", () => {
  const detected = classifyNotificationChanges([
    { action: "standings_recalculated" },
    { action: "matchday_created" },
    { action: "home_news_updated" },
  ]);
  assert.deepEqual(detected, { standings: true, calendar: true, news: true });
});

test("un risultato aggiornato segnala classifica e calendario", () => {
  const detected = classifyNotificationChanges([{ action: "result_corrected" }]);
  assert.deepEqual(detected, { standings: true, calendar: true, news: false });
});
