import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { scoreMatchPredictions } from "../_lib/predictionScoring.js";

// Lo staff indica l'orario reale d'inizio di una partita: i pronostici si chiudono e
// quelli fatti o modificati dopo quell'orario vengono annullati. null lo toglie.
const schema = z.object({
  matchId: documentId,
  startedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin", "admin", "resultManager"]);
    const { matchId, startedAt } = parseBody(schema, req.body);
    if (startedAt && Date.parse(startedAt) > Date.now() + 5 * 60 * 1000) {
      throw new HttpError(400, "L'orario d'inizio non può essere nel futuro");
    }
    const db = admin.firestore(app);
    const ref = db.doc(`matches/${matchId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Partita non trovata");
    const value = startedAt ? new Date(startedAt).toISOString() : null;
    await ref.update({
      predictionsClosedAt: value ?? admin.firestore.FieldValue.delete(),
      predictionsClosedBy: value ? caller.uid : admin.firestore.FieldValue.delete(),
    });
    await db.collection("auditLog").add({
      actor: caller.uid,
      action: "match_predictions_closed",
      entity: `matches/${matchId}`,
      before: { predictionsClosedAt: snap.data().predictionsClosedAt ?? null },
      after: { predictionsClosedAt: value },
      detail: JSON.stringify({ role: caller.role }),
      timestamp: new Date().toISOString(),
    });
    // Se la partita ha già un risultato, i pronostici annullati perdono subito i punti.
    await scoreMatchPredictions(db, matchId);
    res.status(200).json({ ok: true, predictionsClosedAt: value });
  } catch (err) {
    sendError(res, err, "Errore nel salvataggio dell'orario d'inizio");
  }
}
