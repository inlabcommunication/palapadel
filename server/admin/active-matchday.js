import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { editionId, matchdayId } = parseBody(
      z.object({ editionId: documentId, matchdayId: documentId }).strict(),
      req.body
    );
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const dayRef = db.doc(`matchdays/${matchdayId}`);
      const [editionSnap, daySnap, matchesSnap] = await Promise.all([
        transaction.get(editionRef),
        transaction.get(dayRef),
        transaction.get(db.collection("matches").where("matchdayId", "==", matchdayId)),
      ]);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      if (!daySnap.exists || daySnap.data().editionId !== editionId || daySnap.data().isHidden || daySnap.data().deletedAt) {
        throw new HttpError(400, "Giornata non valida");
      }
      if (matchesSnap.empty) throw new HttpError(400, "Una giornata senza partite non può essere attiva");
      transaction.update(editionRef, { activeMatchdayId: matchdayId });
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "active_matchday_changed",
        entity: `championshipEditions/${editionId}`,
        detail: JSON.stringify({ role: caller.role }),
        before: { activeMatchdayId: editionSnap.data().activeMatchdayId ?? null },
        after: { activeMatchdayId: matchdayId },
        timestamp,
      });
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore durante l'impostazione della giornata attiva");
  }
}
