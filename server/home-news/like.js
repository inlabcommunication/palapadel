// Funzione serverless pubblica (nessun login): "mi piace" a una PalaPadel News.
//
// Un mi piace per dispositivo: il dispositivo è riconosciuto dallo stesso codice anonimo
// usato dalle statistiche (installationId, salvato nel browser). La richiesta dichiara lo
// stato voluto (liked true/false), quindi ripeterla non conta due volte. Il totale sta nel
// campo likeCount della news, che l'app legge già: nessuna lettura in più per i visitatori.

import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { createIpRateLimiter, getClientIp } from "../_lib/analyticsRateLimit.js";
import { isPublicNewsData, newsLikeDocId } from "../_lib/newsSocial.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const allowIp = createIpRateLimiter(60);

export default async function handler(req, res) {
  try {
    requirePost(req);
    if (!allowIp(getClientIp(req))) throw new HttpError(429, "Troppe richieste, riprova tra poco");
    const { newsId, installationId, liked } = parseBody(z.object({
      newsId: documentId,
      installationId: z.string().regex(/^[a-zA-Z0-9_-]{16,96}$/),
      liked: z.boolean(),
    }).strict(), req.body);

    // Le anteprime Vercel usano lo stesso database: i mi piace di prova non contano.
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const db = admin.firestore(getAdminApp());
    const newsRef = db.doc(`homeNews/${newsId}`);
    const likeRef = db.doc(`homeNewsLikes/${newsLikeDocId(newsId, installationId)}`);

    const likeCount = await db.runTransaction(async (t) => {
      const [newsSnap, likeSnap] = await Promise.all([t.get(newsRef), t.get(likeRef)]);
      if (!newsSnap.exists || !isPublicNewsData(newsSnap.data())) throw new HttpError(404, "News non trovata");
      const current = Math.max(0, Number(newsSnap.data().likeCount ?? 0));
      if (liked === likeSnap.exists) return current; // già nello stato richiesto
      const next = Math.max(0, current + (liked ? 1 : -1));
      if (liked) t.set(likeRef, { newsId, installationId, createdAt: new Date().toISOString() });
      else t.delete(likeRef);
      t.update(newsRef, { likeCount: next });
      return next;
    });

    res.status(200).json({ ok: true, liked, likeCount });
  } catch (err) {
    sendError(res, err, "Errore durante il salvataggio del mi piace");
  }
}
