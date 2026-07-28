import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin", "admin"]);
    const { editionId, number } = parseBody(
      z.object({ editionId: documentId, number: z.number().int().positive().max(999) }).strict(),
      req.body
    );
    const db = admin.firestore(app);
    const matchdayRef = db.collection("matchdays").doc();
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const editionSnap = await transaction.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      if (editionSnap.data().status !== "attiva") {
        throw new HttpError(400, "La giornata può essere aggiunta solo a un'edizione attiva");
      }
      const duplicateSnap = await transaction.get(
        db.collection("matchdays").where("editionId", "==", editionId).where("number", "==", number)
      );
      if (!duplicateSnap.empty) throw new HttpError(409, "Questa giornata esiste già");

      transaction.set(matchdayRef, { id: matchdayRef.id, editionId, number, createdAt: timestamp });
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "matchday_created",
        detail: JSON.stringify({ role: caller.role, editionId, matchdayId: matchdayRef.id }),
        before: null,
        after: { number },
        timestamp,
      });
    });
    res.status(200).json({ ok: true, matchdayId: matchdayRef.id });
  } catch (err) {
    sendError(res, err, "Errore durante la creazione della giornata");
  }
}
