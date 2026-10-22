import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError } from "../_lib/auth.js";
import { verifyPlayerToken } from "../_lib/playerAuth.js";
import { parseBody, z } from "../_lib/validation.js";
import { nicknameError, normalizeNickname } from "../../shared/predictions.js";

const schema = z.object({
  nickname: z.string().trim().min(1).max(40),
  privacyAccepted: z.literal(true),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const decoded = await verifyPlayerToken(app, req);
    const { nickname } = parseBody(schema, req.body);
    const error = nicknameError(nickname);
    if (error) throw new HttpError(400, error);
    const key = normalizeNickname(nickname);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const playerRef = db.doc(`predictionPlayers/${decoded.uid}`);
      const nicknameRef = db.doc(`predictionNicknames/${key}`);
      const [playerSnap, nicknameSnap] = await t.getAll(playerRef, nicknameRef);
      if (playerSnap.exists) throw new HttpError(409, "Sei già iscritto ai pronostici");
      if (nicknameSnap.exists) throw new HttpError(409, "Questo nickname è già usato: scegline un altro");
      t.set(playerRef, { uid: decoded.uid, nickname, nicknameKey: key, createdAt: timestamp, privacyAcceptedAt: timestamp });
      t.set(nicknameRef, { uid: decoded.uid, createdAt: timestamp });
    });

    res.status(200).json({ ok: true, player: { nickname, createdAt: timestamp } });
  } catch (err) {
    sendError(res, err, "Errore durante l'iscrizione ai pronostici");
  }
}
