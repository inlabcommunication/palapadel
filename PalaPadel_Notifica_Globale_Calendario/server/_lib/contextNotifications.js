export const CONTEXT_NOTIFICATION_KINDS = ["standings", "calendar", "news"];

const ACTION_GROUPS = {
  standings: [
    "standings_",
    "editionteam_",
    "editionteams_",
    "female_",
    "match_result_",
    "result_",
    "bulk_matchday_update",
    "team_status_changed",
  ],
  calendar: [
    "match_",
    "result_",
    "matchday_",
    "active_matchday_changed",
    "bulk_matchday_update",
    "schedule_imported",
  ],
  news: ["home_news_"],
};

export function classifyNotificationChanges(auditEntries) {
  const detected = { standings: false, calendar: false, news: false };
  for (const entry of auditEntries) {
    const action = String(entry.action ?? "");
    for (const kind of CONTEXT_NOTIFICATION_KINDS) {
      if (ACTION_GROUPS[kind].some((prefix) => action === prefix || action.startsWith(prefix))) {
        detected[kind] = true;
      }
    }
  }
  return detected;
}

export function buildContextNotification(kind) {
  if (kind === "standings") {
    return {
      type: "standings_update",
      title: "Aggiornamento classifica",
      body: "La classifica PalaPadel è stata aggiornata.",
      url: "/campionati",
    };
  }
  if (kind === "calendar") {
    return {
      type: "match_result",
      title: "Aggiornamento calendario",
      body: "Il calendario PalaPadel è stato aggiornato.",
      url: "/campionati",
    };
  }
  return {
    type: "news",
    title: "PalaPadel News",
    body: "Controlla le news del PalaPadel.",
    url: "/news",
  };
}
