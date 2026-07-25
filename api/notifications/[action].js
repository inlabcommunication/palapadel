import cancel from "../../server/notifications/cancel.js";
import createDraft from "../../server/notifications/create-draft.js";
import dispatchDue from "../../server/notifications/dispatch-due.js";
import event from "../../server/notifications/event.js";
import history from "../../server/notifications/history.js";
import preferences from "../../server/notifications/preferences.js";
import preview from "../../server/notifications/preview.js";
import retry from "../../server/notifications/retry.js";
import schedule from "../../server/notifications/schedule.js";
import send from "../../server/notifications/send.js";
import settings from "../../server/notifications/settings.js";
import subscribe from "../../server/notifications/subscribe.js";
import diagnostics from "../../server/notifications/diagnostics.js";

const handlers = {
  cancel,
  "create-draft": createDraft,
  "dispatch-due": dispatchDue,
  event,
  history,
  preferences,
  preview,
  retry,
  schedule,
  send,
  settings,
  subscribe,
  diagnostics,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint notifications non trovato" });
    return;
  }
  return routeHandler(req, res);
}

function getAction(req) {
  const queryAction = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
  if (queryAction) return queryAction;
  const path = (req.url || "").split("?")[0].split("/").filter(Boolean);
  return path[path.length - 1];
}
