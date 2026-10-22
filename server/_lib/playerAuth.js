import { admin } from "./firebaseAdmin.js";
import { HttpError } from "./auth.js";

/**
 * Pronostici: basta un account Firebase valido (anche non staff). Non dà alcun
 * permesso di gestione: quelli dipendono solo da users/{uid}, che qui non viene creato.
 */
export async function verifyPlayerToken(app, req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) throw new HttpError(401, "Accedi per giocare ai pronostici");
  try {
    return await admin.auth(app).verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, "Sessione scaduta: accedi di nuovo");
  }
}

export async function requirePlayer(db, uid) {
  const snap = await db.doc(`predictionPlayers/${uid}`).get();
  if (!snap.exists) throw new HttpError(403, "Completa l'iscrizione ai pronostici");
  return snap.data();
}
