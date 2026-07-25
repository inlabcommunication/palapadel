// Funzione serverless (Vercel). Fase 2 — tutte le modifiche strutturali alla classifica
// (aggiunta squadra, modifica manuale punti/partite/ordine/correzioni, rimozione) passano
// da qui. Il frontend NON usa più updateDoc/setDoc/deleteDoc direttamente su editionTeams
// (firestore.rules lo nega comunque a qualunque ruolo, incluso admin/superAdmin).
//
// Non gestisce i cambi di stato ritirata/squalificata/riattivata: quelli hanno effetti a
// cascata sulle partite e vivono in api/standings/set-status.js.
//
// Body atteso: { op: "add"|"update"|"remove", editionId, ...campi specifici per op }

import admin from "firebase-admin";
import { computeMatchTotalsForTeam } from "../_lib/standingsRules.js";

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function verifyCaller(app, req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) throw new HttpError(401, "Token mancante");
  const decoded = await admin.auth(app).verifyIdToken(idToken);
  const callerSnap = await admin.firestore(app).doc(`users/${decoded.uid}`).get();
  if (!callerSnap.exists) throw new HttpError(403, "Utente non registrato");
  const callerData = callerSnap.data();
  if (callerData.disabled) throw new HttpError(403, "Account disattivato");
  // Fase 2/7 — solo admin/superAdmin gestiscono manualmente la classifica: mai il resultManager.
  if (!["superadmin", "admin"].includes(callerData.role)) {
    throw new HttpError(403, "Solo admin o superAdmin possono modificare la classifica");
  }
  return { uid: decoded.uid, role: callerData.role };
}

async function assertEditionHasTeams(db, editionId) {
  const editionSnap = await db.doc(`championshipEditions/${editionId}`).get();
  if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
  const typeSnap = await db.doc(`championshipTypes/${editionSnap.data().typeId}`).get();
  if (!typeSnap.exists || !typeSnap.data().hasTeams) {
    throw new HttpError(400, "Il campionato non è a squadre.");
  }
  return editionSnap.data();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const auth = await verifyCaller(app, req);
    const db = admin.firestore(app);
    const { op, editionId } = req.body || {};
    if (!op || !editionId) throw new HttpError(400, "Dati mancanti");

    await assertEditionHasTeams(db, editionId);
    const timestamp = new Date().toISOString();

    if (op === "add") {
      const { teamId, newTeam } = req.body;
      if (!teamId && !newTeam) throw new HttpError(400, "Specificare teamId oppure newTeam");

      await db.runTransaction(async (t) => {
        let finalTeamId = teamId;
        if (newTeam) {
          if (!newTeam.name || !Array.isArray(newTeam.roster) || newTeam.roster.length < 2 || newTeam.roster.length > 6) {
            throw new HttpError(400, "Nome squadra e rosa (2-6 giocatori) obbligatori.");
          }
          const teamRef = db.collection("teams").doc();
          finalTeamId = teamRef.id;
          t.set(teamRef, { name: newTeam.name.trim(), roster: newTeam.roster });
        } else {
          const teamSnap = await t.get(db.doc(`teams/${teamId}`));
          if (!teamSnap.exists) throw new HttpError(404, "Squadra non trovata.");
        }

        const entryId = `${editionId}_${finalTeamId}`;
        const existingSnap = await t.get(db.doc(`editionTeams/${entryId}`));
        if (existingSnap.exists) throw new HttpError(400, "Questa squadra è già iscritta a questa edizione.");

        const countSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));
        const nextOrder = countSnap.size; // Fase 12 — mai order:0 per tutte, progressivo in base all'ordine di iscrizione.

        t.set(db.doc(`editionTeams/${entryId}`), {
          id: entryId,
          editionId,
          teamId: finalTeamId,
          baselinePoints: 0,
          baselinePlayed: 0,
          matchPoints: 0,
          matchPlayed: 0,
          manualPointsAdjustment: 0,
          manualPlayedAdjustment: 0,
          points: 0,
          played: 0,
          order: nextOrder,
          status: "normale",
        });

        t.set(db.collection("auditLog").doc(), {
          actor: auth.uid,
          action: "editionteam_added",
          detail: JSON.stringify({ role: auth.role, editionId, teamId: finalTeamId }),
          before: null,
          after: { teamId: finalTeamId },
          timestamp,
        });
      });

      res.status(200).json({ ok: true });
      return;
    }

    if (op === "update") {
      const { editionTeamId, baselinePoints, baselinePlayed, manualPointsAdjustment, manualPlayedAdjustment, order } =
        req.body;
      if (!editionTeamId) throw new HttpError(400, "editionTeamId mancante");
      if ([baselinePoints, baselinePlayed, manualPointsAdjustment, manualPlayedAdjustment, order].some((v) => typeof v !== "number")) {
        throw new HttpError(400, "baselinePoints/baselinePlayed/manualPointsAdjustment/manualPlayedAdjustment/order devono essere numeri.");
      }

      await db.runTransaction(async (t) => {
        const entryRef = db.doc(`editionTeams/${editionTeamId}`);
        const entrySnap = await t.get(entryRef);
        if (!entrySnap.exists) throw new HttpError(404, "Voce di classifica non trovata.");
        const before = entrySnap.data();
        if (before.editionId !== editionId) throw new HttpError(400, "La voce non appartiene a questa edizione.");

        const matchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
        const matchTotals = computeMatchTotalsForTeam(
          matchesSnap.docs.map((d) => d.data()),
          before.teamId
        );

        const finalPoints = baselinePoints + matchTotals.points + manualPointsAdjustment;
        const finalPlayed = baselinePlayed + matchTotals.played + manualPlayedAdjustment;

        t.update(entryRef, {
          baselinePoints,
          baselinePlayed,
          matchPoints: matchTotals.points,
          matchPlayed: matchTotals.played,
          manualPointsAdjustment,
          manualPlayedAdjustment,
          points: finalPoints,
          played: finalPlayed,
          order,
        });

        t.set(db.collection("auditLog").doc(), {
          actor: auth.uid,
          action: "editionteam_updated",
          detail: JSON.stringify({ role: auth.role, editionId, editionTeamId }),
          before: { points: before.points, played: before.played, order: before.order },
          after: { points: finalPoints, played: finalPlayed, order },
          timestamp,
        });
      });

      res.status(200).json({ ok: true });
      return;
    }

    if (op === "remove") {
      const { editionTeamId } = req.body;
      if (!editionTeamId) throw new HttpError(400, "editionTeamId mancante");

      await db.runTransaction(async (t) => {
        const entryRef = db.doc(`editionTeams/${editionTeamId}`);
        const entrySnap = await t.get(entryRef);
        if (!entrySnap.exists) throw new HttpError(404, "Voce di classifica non trovata.");
        const before = entrySnap.data();
        if (before.editionId !== editionId) throw new HttpError(400, "La voce non appartiene a questa edizione.");

        t.delete(entryRef);
        t.set(db.collection("auditLog").doc(), {
          actor: auth.uid,
          action: "editionteam_removed",
          detail: JSON.stringify({ role: auth.role, editionId, editionTeamId }),
          before: { teamId: before.teamId, points: before.points, played: before.played },
          after: null,
          timestamp,
        });
      });

      res.status(200).json({ ok: true });
      return;
    }

    throw new HttpError(400, `Operazione "${op}" non riconosciuta.`);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno nella gestione della classifica" });
  }
}
