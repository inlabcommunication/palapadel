// Server-side structural match update: teams and/or matchday can be changed only by
// admin/superAdmin. Validation and writes run in one Firestore transaction so a moved
// match cannot create duplicate team usage in the target matchday under concurrent edits.

import admin from "firebase-admin";
import { areSameTeamIds } from "../_lib/matchValidation.js";
import { computeStandingsUpdates } from "../_lib/standingsRules.js";

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
    throw new HttpError(403, "Solo admin o superAdmin possono modificare partite");
  }
  return { uid: decoded.uid, role: callerData.role };
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
    const { matchId, matchdayId, team1Id, team2Id } = req.body || {};
    if (!matchId) throw new HttpError(400, "matchId mancante");

    const matchRef = db.doc(`matches/${matchId}`);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const matchSnap = await t.get(matchRef);
      if (!matchSnap.exists) throw new HttpError(404, "Partita non trovata");
      const before = matchSnap.data();
      const editionId = before.editionId;
      const nextMatchdayId = matchdayId ?? before.matchdayId;
      const nextTeam1Id = team1Id ?? before.team1Id;
      const nextTeam2Id = team2Id ?? before.team2Id;

      if (areSameTeamIds(nextTeam1Id, nextTeam2Id)) throw new HttpError(400, "Le due squadre coincidono.");

      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const editionSnap = await t.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata.");
      if (editionSnap.data().status !== "attiva") {
        throw new HttpError(400, "Si possono modificare partite solo su edizioni attive.");
      }

      const typeSnap = await t.get(db.doc(`championshipTypes/${editionSnap.data().typeId}`));
      if (!typeSnap.exists || !typeSnap.data().hasTeams) {
        throw new HttpError(400, "Il campionato non e a squadre: le partite non si applicano.");
      }

      const matchdaySnap = await t.get(db.doc(`matchdays/${nextMatchdayId}`));
      if (!matchdaySnap.exists || matchdaySnap.data().editionId !== editionId) {
        throw new HttpError(404, "Giornata non trovata per questa edizione.");
      }

      const et1Snap = await t.get(db.doc(`editionTeams/${editionId}_${nextTeam1Id}`));
      const et2Snap = await t.get(db.doc(`editionTeams/${editionId}_${nextTeam2Id}`));
      if (!et1Snap.exists) throw new HttpError(400, `La squadra ${nextTeam1Id} non e iscritta all'edizione.`);
      if (!et2Snap.exists) throw new HttpError(400, `La squadra ${nextTeam2Id} non e iscritta all'edizione.`);

      const existingMatchesSnap = await t.get(db.collection("matches").where("matchdayId", "==", nextMatchdayId));
      for (const matchDoc of existingMatchesSnap.docs) {
        if (matchDoc.id === matchId) continue;
        const m = matchDoc.data();
        if (m.team1Id === nextTeam1Id || m.team2Id === nextTeam1Id) {
          throw new HttpError(400, `La squadra ${nextTeam1Id} e gia presente in questa giornata.`);
        }
        if (m.team1Id === nextTeam2Id || m.team2Id === nextTeam2Id) {
          throw new HttpError(400, `La squadra ${nextTeam2Id} e gia presente in questa giornata.`);
        }
        const samePairAnyOrder =
          (m.team1Id === nextTeam1Id && m.team2Id === nextTeam2Id) ||
          (m.team1Id === nextTeam2Id && m.team2Id === nextTeam1Id);
        if (samePairAnyOrder) throw new HttpError(400, "Questa partita e gia presente.");
      }

      const matchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
      const editionTeamsSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));
      const allMatches = matchesSnap.docs.map((d) =>
        d.id === matchId ? { ...d.data(), matchdayId: nextMatchdayId, team1Id: nextTeam1Id, team2Id: nextTeam2Id } : d.data()
      );
      const standingsUpdates = computeStandingsUpdates(editionTeamsSnap.docs, allMatches);

      t.update(matchRef, {
        matchdayId: nextMatchdayId,
        team1Id: nextTeam1Id,
        team2Id: nextTeam2Id,
        updatedAt: timestamp,
        updatedBy: auth.uid,
      });
      for (const u of standingsUpdates) t.update(u.ref, u.data);
      t.update(editionRef, { lastRecalculatedAt: timestamp });
      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "match_updated",
        detail: JSON.stringify({ role: auth.role, editionId, matchId, fromMatchdayId: before.matchdayId, toMatchdayId: nextMatchdayId }),
        before: { matchdayId: before.matchdayId, team1Id: before.team1Id, team2Id: before.team2Id, status: before.status, result: before.result ?? null },
        after: { matchdayId: nextMatchdayId, team1Id: nextTeam1Id, team2Id: nextTeam2Id, status: before.status, result: before.result ?? null },
        timestamp,
      });
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante la modifica della partita" });
  }
}
