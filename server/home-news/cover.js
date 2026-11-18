// Copertina di una news servita dallo stesso indirizzo dell'app (GET /api/home-news/cover?id=).
//
// Serve per l'immagine delle Storie Instagram: il browser può disegnare in un canvas solo
// immagini dello stesso sito o con permessi CORS, e Firebase Storage non li dà. Il server
// scarica la foto della news (solo news pubbliche, solo da Firebase/Google Storage: non è
// un proxy aperto) e la restituisce.

import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { isAllowedCoverUrl, isPublicNewsData } from "../_lib/newsSocial.js";

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Metodo non consentito" });
      return;
    }
    const raw = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    const id = String(raw ?? "");
    if (!/^[^/]{1,200}$/.test(id)) {
      res.status(400).json({ error: "News non valida" });
      return;
    }
    const snap = await admin.firestore(getAdminApp()).doc(`homeNews/${id}`).get();
    const news = snap.exists ? snap.data() : null;
    if (!isPublicNewsData(news) || !isAllowedCoverUrl(news.imageUrl)) {
      res.status(404).json({ error: "Copertina non disponibile" });
      return;
    }
    const response = await fetch(news.imageUrl);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) {
      res.status(502).json({ error: "Copertina non disponibile" });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      res.status(413).json({ error: "Copertina troppo grande" });
      return;
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("cover: errore", err);
    res.status(500).json({ error: "Errore interno" });
  }
}
