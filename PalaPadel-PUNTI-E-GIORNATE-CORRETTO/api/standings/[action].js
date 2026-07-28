import importStandings from "../../server/standings/import.js";
import manageEntry from "../../server/standings/manage-entry.js";
import recalculate from "../../server/standings/recalculate.js";
import setStatus from "../../server/standings/set-status.js";

const handlers = {
  import: importStandings,
  "manage-entry": manageEntry,
  recalculate,
  "set-status": setStatus,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint standings non trovato" });
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
