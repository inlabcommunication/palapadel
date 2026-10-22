import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError } from "../_lib/auth.js";
import { verifyPlayerToken } from "../_lib/playerAuth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

// I miei pronostici per le partite mostrate a schermo (una lettura per partita).
export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const decoded = await verifyPlayerToken(app, req);
    const { matchIds } = parseBody(z.object({ matchIds: z.array(documentId).max(150) }).strict(), req.body);
    const db = admin.firestore(app);
    const unique = [...new Set(matchIds)];
    const snaps = unique.length ? await db.getAll(...unique.map((id) => db.doc(`predictions/${decoded.uid}_${id}`))) : [];
    const picks = {};
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data();
      picks[data.matchId] = { pick: data.pick, points: data.points ?? null, exact: data.exact ?? null, voided: data.voided === true };
    }
    res.status(200).json({ ok: true, picks });
  } catch (err) {
    sendError(res, err, "Errore nel caricamento dei pronostici");
  }
}
