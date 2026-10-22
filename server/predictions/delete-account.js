import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError } from "../_lib/auth.js";
import { verifyPlayerToken } from "../_lib/playerAuth.js";
import { parseBody, z } from "../_lib/validation.js";

// Cancellazione dell'account pronostici: profilo, nickname, pronostici, righe nelle
// classifiche e account di accesso (se non è uno account dello staff).
export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const decoded = await verifyPlayerToken(app, req);
    parseBody(z.object({ confirmation: z.literal("ELIMINA") }).strict(), req.body);
    const db = admin.firestore(app);
    const uid = decoded.uid;

    const [playerSnap, predictionsSnap, boardsSnap, staffSnap] = await Promise.all([
      db.doc(`predictionPlayers/${uid}`).get(),
      db.collection("predictions").where("uid", "==", uid).get(),
      db.collection("predictionLeaderboards").get(),
      db.doc(`users/${uid}`).get(),
    ]);

    const writes = predictionsSnap.docs.map((doc) => (batch) => batch.delete(doc.ref));
    for (const board of boardsSnap.docs) {
      if (board.data().entries?.[uid]) {
        writes.push((batch) => batch.update(board.ref, { [`entries.${uid}`]: admin.firestore.FieldValue.delete() }));
      }
    }
    if (playerSnap.exists) {
      writes.push((batch) => batch.delete(playerSnap.ref));
      const key = playerSnap.data().nicknameKey;
      if (key) writes.push((batch) => batch.delete(db.doc(`predictionNicknames/${key}`)));
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      writes.slice(i, i + 400).forEach((write) => write(batch));
      await batch.commit();
    }
    // Gli account dello staff restano: si cancella solo la partecipazione ai pronostici.
    if (!staffSnap.exists) await admin.auth(app).deleteUser(uid);

    res.status(200).json({ ok: true, deletedPredictions: predictionsSnap.size, accountDeleted: !staffSnap.exists });
  } catch (err) {
    sendError(res, err, "Errore durante l'eliminazione dell'account");
  }
}
