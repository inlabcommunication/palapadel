import { admin, getAdminApp } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

function storagePathFromNews(news) {
  if (news.imageStoragePath) return news.imageStoragePath;
  if (!news.imageUrl) return null;
  try {
    const url = new URL(news.imageUrl);
    const marker = "/o/";
    const index = url.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const auth = await verifyCaller(app, req, ["superAdmin"]);
    const { newsId } = parseBody(z.object({ newsId: documentId }).strict(), req.body);

    const db = admin.firestore(app);
    const newsRef = db.doc(`homeNews/${newsId}`);
    const snapshot = await newsRef.get();
    if (!snapshot.exists) throw new HttpError(404, "News non trovata");

    const before = snapshot.data();
    const timestamp = new Date().toISOString();

    // La news sparisce subito dal pubblico. Se Storage fallisce resta recuperabile,
    // marcata come eliminata, e il file potra essere ripulito con un nuovo tentativo.
    await newsRef.update({
      status: "bozza",
      isActive: false,
      deletedAt: timestamp,
      deletedBy: auth.uid,
    });

    const storagePath = storagePathFromNews(before);
    if (storagePath) {
      try {
        await admin.storage(app).bucket().file(storagePath).delete({ ignoreNotFound: true });
      } catch (error) {
        console.error("Eliminazione immagine news fallita", { newsId, storagePath, error });
        throw new HttpError(
          502,
          "La news e stata rimossa dal pubblico, ma l'immagine non e stata eliminata. Riprova."
        );
      }
    }

    const batch = db.batch();
    batch.delete(newsRef);
    batch.set(db.collection("auditLog").doc(), {
      actor: auth.uid,
      action: "home_news_deleted",
      detail: JSON.stringify({ role: auth.role, newsId, storagePath }),
      before,
      after: null,
      timestamp,
    });
    await batch.commit();

    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore interno durante l'eliminazione della news");
  }
}
