import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError } from "../_lib/auth.js";
import { verifyPlayerToken } from "../_lib/playerAuth.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const decoded = await verifyPlayerToken(app, req);
    const snap = await admin.firestore(app).doc(`predictionPlayers/${decoded.uid}`).get();
    const player = snap.exists ? snap.data() : null;
    res.status(200).json({
      ok: true,
      player: player ? { nickname: player.nickname, createdAt: player.createdAt } : null,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified === true,
    });
  } catch (err) {
    sendError(res, err, "Errore nel caricamento del profilo");
  }
}
