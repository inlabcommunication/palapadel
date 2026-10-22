import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { requirePlayer, verifyPlayerToken } from "../_lib/playerAuth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { PICKS, currentPeriod, isMatchOpen } from "../../shared/predictions.js";

const schema = z.object({ matchId: documentId, pick: z.enum(PICKS) }).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const decoded = await verifyPlayerToken(app, req);
    const { matchId, pick } = parseBody(schema, req.body);
    const db = admin.firestore(app);
    await requirePlayer(db, decoded.uid);

    const [matchSnap, periodsSnap] = await Promise.all([
      db.doc(`matches/${matchId}`).get(),
      db.collection("predictionPeriods").get(),
    ]);
    if (!matchSnap.exists) throw new HttpError(404, "Partita non trovata");
    const match = matchSnap.data();
    const period = currentPeriod(periodsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    if (!period || !(period.editionIds ?? []).includes(match.editionId)) {
      throw new HttpError(400, "Questa partita non fa parte della gara pronostici in corso");
    }
    const editionSnap = await db.doc(`championshipEditions/${match.editionId}`).get();
    const edition = editionSnap.exists ? editionSnap.data() : null;
    if (!edition || edition.status !== "attiva" || edition.isPubliclyVisible === false) {
      throw new HttpError(400, "Il campionato di questa partita non è attivo");
    }
    if (!isMatchOpen(match)) throw new HttpError(409, "Pronostici chiusi: la partita è già iniziata o conclusa");

    const ref = db.doc(`predictions/${decoded.uid}_${matchId}`);
    const timestamp = new Date().toISOString();
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      t.set(ref, {
        uid: decoded.uid,
        matchId,
        editionId: match.editionId,
        matchdayId: match.matchdayId,
        pick,
        createdAt: snap.exists ? snap.data().createdAt : timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    });
    res.status(200).json({ ok: true, pick });
  } catch (err) {
    sendError(res, err, "Errore nel salvataggio del pronostico");
  }
}
