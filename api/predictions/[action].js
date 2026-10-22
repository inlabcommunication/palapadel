import profile from "../../server/predictions/profile.js";
import register from "../../server/predictions/register.js";
import picks from "../../server/predictions/picks.js";
import pick from "../../server/predictions/pick.js";
import leaderboard from "../../server/predictions/leaderboard.js";
import deleteAccount from "../../server/predictions/delete-account.js";
import adminActions from "../../server/predictions/admin.js";
import matchStart from "../../server/predictions/match-start.js";

const handlers = {
  profile,
  register,
  picks,
  pick,
  leaderboard,
  "delete-account": deleteAccount,
  admin: adminActions,
  "match-start": matchStart,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint pronostici non trovato" });
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
