import cover from "../../server/home-news/cover.js";
import createResultUpdate from "../../server/home-news/create-result-update.js";
import deleteNews from "../../server/home-news/delete.js";
import like from "../../server/home-news/like.js";
import sharePage from "../../server/home-news/share-page.js";
import upsert from "../../server/home-news/upsert.js";

const handlers = {
  cover,
  "create-result-update": createResultUpdate,
  delete: deleteNews,
  like,
  "share-page": sharePage,
  upsert,
};

export default function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];
  if (!routeHandler) {
    res.status(404).json({ error: "Endpoint home-news non trovato" });
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
