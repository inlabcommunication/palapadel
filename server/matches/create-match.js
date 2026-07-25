// Funzione serverless (Vercel). Fase 9 — crea una partita SOLO lato backend, con tutte
// le validazioni: squadre diverse, entrambe iscritte all'edizione, nessuna delle due già
// impegnata nella stessa giornata, partita non già esistente (anche con squadre invertite).
// Riservata ad admin/superAdmin (il resultManager non crea mai partite).
//
// Body atteso: { editionId, matchdayId, team1Id, team2Id }

import admin from "firebase-admin";
import { areSameTeamIds } from "../_lib/matchValidation.js";

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
  // Fase 9: solo admin/superAdmin creano partite, mai il resultManager.
  if (!["superadmin", "admin"].includes(callerData.role)) {
    throw new HttpError(403, "Solo admin o superAdmin possono creare partite");
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

    const { editionId, matchdayId, team1Id, team2Id, matchDate, matchTime } = req.body || {};
    if (!editionId || !matchdayId || !team1Id || !team2Id) {
      throw new HttpError(400, "Dati mancanti");
    }
    if (areSameTeamIds(team1Id, team2Id)) {
      throw new HttpError(400, "Le due squadre coincidono.");
    }
    if (matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) throw new HttpError(400, "Data partita non valida.");
    if (matchTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(matchTime)) throw new HttpError(400, "Ora partita non valida.");

    const db = admin.firestore(app);
    const matchRef = db.collection("matches").doc();
    const timestamp = new Date().toISOString();

    // Fase 5 — tutta la verifica e la scrittura avvengono nella STESSA transazione:
    // se due admin creano contemporaneamente una partita con una squadra in comune
    // nella stessa giornata, Firestore rilegge e riesegue automaticamente una delle due
    // transazioni quando rileva che i dati letti (le partite della giornata) sono
    // cambiati nel frattempo, così solo una delle due può davvero riuscire.
    await db.runTransaction(async (t) => {
      const editionSnap = await t.get(db.doc(`championshipEditions/${editionId}`));
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata.");
      const typeSnap = await t.get(db.doc(`championshipTypes/${editionSnap.data().typeId}`));
      if (!typeSnap.exists || !typeSnap.data().hasTeams) {
        throw new HttpError(400, "Il campionato non è a squadre: le partite non si applicano.");
      }
      if (editionSnap.data().status !== "attiva") {
        throw new HttpError(400, "Si possono creare partite solo su edizioni attive.");
      }

      const matchdaySnap = await t.get(db.doc(`matchdays/${matchdayId}`));
      if (!matchdaySnap.exists || matchdaySnap.data().editionId !== editionId) {
        throw new HttpError(404, "Giornata non trovata per questa edizione.");
      }

      const et1Snap = await t.get(db.doc(`editionTeams/${editionId}_${team1Id}`));
      const et2Snap = await t.get(db.doc(`editionTeams/${editionId}_${team2Id}`));
      if (!et1Snap.exists) throw new HttpError(400, `La squadra ${team1Id} non è iscritta all'edizione.`);
      if (!et2Snap.exists) throw new HttpError(400, `La squadra ${team2Id} non è iscritta all'edizione.`);

      const existingMatchesSnap = await t.get(db.collection("matches").where("matchdayId", "==", matchdayId));
      for (const matchDoc of existingMatchesSnap.docs) {
        const m = matchDoc.data();
        if (m.team1Id === team1Id || m.team2Id === team1Id) {
          throw new HttpError(400, `La squadra ${team1Id} è già presente in questa giornata.`);
        }
        if (m.team1Id === team2Id || m.team2Id === team2Id) {
          throw new HttpError(400, `La squadra ${team2Id} è già presente in questa giornata.`);
        }
        const samePairAnyOrder =
          (m.team1Id === team1Id && m.team2Id === team2Id) || (m.team1Id === team2Id && m.team2Id === team1Id);
        if (samePairAnyOrder) throw new HttpError(400, "Questa partita è già presente.");
      }

      t.set(matchRef, {
        editionId,
        matchdayId,
        team1Id,
        team2Id,
        status: "da_giocare",
        ...(matchDate ? { matchDate } : {}),
        ...(matchTime ? { matchTime } : {}),
        updatedAt: timestamp,
        updatedBy: auth.uid,
      });
      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "match_created",
        detail: JSON.stringify({ role: auth.role, editionId, matchdayId, matchId: matchRef.id }),
        before: null,
        after: { team1Id, team2Id, status: "da_giocare", matchDate: matchDate ?? null, matchTime: matchTime ?? null },
        timestamp,
      });
    });

    res.status(200).json({ ok: true, matchId: matchRef.id });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante la creazione della partita" });
  }
}
