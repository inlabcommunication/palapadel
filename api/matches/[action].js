import createMatch from "../../server/matches/create-match.js";
import deleteMatch from "../../server/matches/delete-match.js";
import saveBulk from "../../server/matches/save-bulk.js";
import saveResult from "../../server/matches/save-result.js";
import updateMatch from "../../server/matches/update-match.js";
import createMatchday from "../../server/matches/create-matchday.js";

const handlers = {
  "create-match": createMatch,
  "delete-match": deleteMatch,
  "save-bulk": saveBulk,
  "save-result": saveResult,
  "update-match": updateMatch,
  "create-matchday": createMatchday,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint matches non trovato" });
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
