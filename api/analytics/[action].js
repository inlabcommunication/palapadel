import summary from "../../server/analytics/summary.js";
import track from "../../server/analytics/track.js";
import reset from "../../server/analytics/reset.js";
import error from "../../server/analytics/error.js";

const handlers = {
  summary,
  track,
  reset,
  error,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint analytics non trovato" });
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
