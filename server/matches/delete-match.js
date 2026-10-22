// Funzione serverless (Vercel). Elimina una partita e ricalcola la classifica
// dell'edizione nella stessa transazione (una partita "conclusa" eliminata toglie punti
// alle squadre coinvolte). Riservata ad admin/superAdmin.
//
// Body atteso: { matchId }

import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, verifyCaller } from "../_lib/auth.js";
import { computeStandingsUpdates } from "../_lib/standingsRules.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const auth = await verifyCaller(app, req, ["superAdmin", "admin"], "Solo admin o superAdmin possono eliminare partite");

    const { matchId } = parseBody(z.object({ matchId: documentId }).strict(), req.body);

    const db = admin.firestore(app);
    const matchRef = db.doc(`matches/${matchId}`);
    const updatedAt = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const matchSnap = await t.get(matchRef);
      if (!matchSnap.exists) throw new HttpError(404, "Partita non trovata");
      const before = matchSnap.data();
      const editionId = before.editionId;

      const matchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
      const editionTeamsSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));

      const remainingMatches = matchesSnap.docs.filter((d) => d.id !== matchId).map((d) => d.data());
      const standingsUpdates = computeStandingsUpdates(editionTeamsSnap.docs, remainingMatches);

      t.delete(matchRef);
      for (const u of standingsUpdates) t.update(u.ref, u.data);

      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "match_deleted",
        detail: JSON.stringify({ role: auth.role, editionId, matchdayId: before.matchdayId, matchId }),
        before: { team1Id: before.team1Id, team2Id: before.team2Id, status: before.status, result: before.result ?? null },
        after: null,
        timestamp: updatedAt,
      });
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err?.details?.code === "VALIDATION_ERROR") {
      res.status(err.status ?? 400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message, fields: err.details.fields ?? {} } });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante l'eliminazione della partita" });
  }
}
