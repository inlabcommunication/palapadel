// Funzione serverless (Vercel). Elimina una partita e ricalcola la classifica
// dell'edizione nella stessa transazione (una partita "conclusa" eliminata toglie punti
// alle squadre coinvolte). Riservata ad admin/superAdmin.
//
// Body atteso: { matchId }

import admin from "firebase-admin";

const STANDING_POINTS = {
  "2-0": { team1: 3, team2: 0 },
  "2-1": { team1: 2, team2: 1 },
  "1-2": { team1: 1, team2: 2 },
  "0-2": { team1: 0, team2: 3 },
};

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
  if (!["superadmin", "admin"].includes(callerData.role)) {
    throw new HttpError(403, "Solo admin o superAdmin possono eliminare partite");
  }
  return { uid: decoded.uid, role: callerData.role };
}

function computeStandingsUpdates(editionTeamsSnapDocs, allMatches) {
  const totals = new Map();
  for (const m of allMatches) {
    if (m.status !== "conclusa") continue;
    const pts = STANDING_POINTS[m.result];
    if (!pts) continue;
    const t1 = totals.get(m.team1Id) ?? { points: 0, played: 0 };
    t1.points += pts.team1;
    t1.played += 1;
    totals.set(m.team1Id, t1);
    const t2 = totals.get(m.team2Id) ?? { points: 0, played: 0 };
    t2.points += pts.team2;
    t2.played += 1;
    totals.set(m.team2Id, t2);
  }
  return editionTeamsSnapDocs.map((doc) => {
    const et = doc.data();
    const matchTotals = totals.get(et.teamId) ?? { points: 0, played: 0 };
    const manualPoints = et.manualPointsAdjustment ?? 0;
    const manualPlayed = et.manualPlayedAdjustment ?? 0;
    const baselinePoints = et.baselinePoints ?? Math.max(0, (et.points ?? 0) - matchTotals.points - manualPoints);
    const baselinePlayed = et.baselinePlayed ?? Math.max(0, (et.played ?? 0) - matchTotals.played - manualPlayed);
    return {
      ref: doc.ref,
      data: {
        baselinePoints,
        baselinePlayed,
        matchPoints: matchTotals.points,
        matchPlayed: matchTotals.played,
        points: baselinePoints + matchTotals.points + manualPoints,
        played: baselinePlayed + matchTotals.played + manualPlayed,
      },
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const auth = await verifyCaller(app, req);

    const { matchId } = req.body || {};
    if (!matchId) throw new HttpError(400, "matchId mancante");

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
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante l'eliminazione della partita" });
  }
}
