import setPassword from "../../server/admin/set-password.js";
import backup from "../../server/admin/backup.js";
import championshipOrder from "../../server/admin/championship-order.js";
import closeEdition from "../../server/admin/close-edition.js";
import importSchedule from "../../server/admin/import-schedule.js";
import storageCleanup from "../../server/admin/storage-cleanup.js";
import undoAudit from "../../server/admin/undo-audit.js";
import team from "../../server/admin/team.js";
import activeMatchday from "../../server/admin/active-matchday.js";
import championship from "../../server/admin/championship.js";
import user from "../../server/admin/user.js";
import femaleParticipant from "../../server/admin/female-participant.js";
import hallOfFame from "../../server/admin/hall-of-fame.js";
import bracket from "../../server/admin/bracket.js";
import publicSettings from "../../server/admin/public-settings.js";
import tournament from "../../server/admin/tournament.js";

const handlers = {
  "set-password": setPassword,
  backup,
  "championship-order": championshipOrder,
  "close-edition": closeEdition,
  "import-schedule": importSchedule,
  "storage-cleanup": storageCleanup,
  "undo-audit": undoAudit,
  team,
  "active-matchday": activeMatchday,
  championship,
  user,
  "female-participant": femaleParticipant,
  "hall-of-fame": hallOfFame,
  bracket,
  "public-settings": publicSettings,
  tournament,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint admin non trovato" });
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
