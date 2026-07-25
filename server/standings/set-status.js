// Funzione serverless (Vercel). Fase 2 — cambio di stato di una squadra (ritirata,
// squalificata, riattivata) con effetto a cascata sulle partite coinvolte, come UNICA
// transazione: stato squadra, partite, classifica e audit log insieme.
//
// Body atteso: { editionId, editionTeamId, newStatus: "ritirata"|"squalificata"|"normale", policy?: 1|2|3|4 }
//
// Politiche (richieste per newStatus "ritirata"/"squalificata", non per "normale"):
//   1 — annulla tutte le partite passate e future (tutte -> annullata, nessun risultato);
//   2 — conserva le partite già concluse, annulla solo quelle future (da_giocare);
//   3 — assegna 2-0 agli avversari per TUTTE le partite (concluse comprese, corrette);
//   4 — conserva le concluse, assegna 2-0 agli avversari solo nelle future (da_giocare).
// "Passate" = partite già "conclusa"; "future" = partite ancora "da_giocare". Le partite
// già "rinviata"/"annullata" non vengono ritoccate da nessuna politica.

import admin from "firebase-admin";

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
    throw new HttpError(403, "Solo admin o superAdmin possono cambiare lo stato di una squadra");
  }
  return { uid: decoded.uid, role: callerData.role };
}

const STANDING_POINTS = {
  "2-0": { team1: 3, team2: 0 },
  "2-1": { team1: 2, team2: 1 },
  "1-2": { team1: 1, team2: 2 },
  "0-2": { team1: 0, team2: 3 },
};
const ALLOWED_STATUSES = ["ritirata", "squalificata", "normale"];

function computeStandingsUpdates(editionTeamsDocs, allMatches) {
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
  return editionTeamsDocs.map((doc) => {
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

/** Calcola come una singola partita coinvolta va trattata secondo la politica scelta. */
function applyPolicyToMatch(match, teamId, policy) {
  const isPast = match.status === "conclusa";
  const isFuture = match.status === "da_giocare";
  if (!isPast && !isFuture) return null; // rinviata/annullata: non toccata da nessuna politica

  const opponentIsTeam1 = match.team1Id !== teamId; // se il nostro team è team2, l'avversario è team1
  const winResultForOpponent = opponentIsTeam1 ? "2-0" : "0-2";

  switch (policy) {
    case 1: // annulla tutte
      return { status: "annullata", result: null };
    case 2: // conserva le concluse, annulla le future
      return isFuture ? { status: "annullata", result: null } : null;
    case 3: // 2-0 agli avversari per tutte
      return { status: "conclusa", result: winResultForOpponent };
    case 4: // conserva le concluse, 2-0 agli avversari nelle future
      return isFuture ? { status: "conclusa", result: winResultForOpponent } : null;
    default:
      return null;
  }
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

    const { editionId, editionTeamId, newStatus, policy } = req.body || {};
    if (!editionId || !editionTeamId || !newStatus) throw new HttpError(400, "Dati mancanti");
    if (!ALLOWED_STATUSES.includes(newStatus)) throw new HttpError(400, "Stato non valido");
    if (newStatus !== "normale" && ![1, 2, 3, 4].includes(policy)) {
      throw new HttpError(400, "Specificare una politica (1-4) per ritirata/squalificata");
    }

    const editionRef = db.doc(`championshipEditions/${editionId}`);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const editionSnap = await t.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      const typeSnap = await t.get(db.doc(`championshipTypes/${editionSnap.data().typeId}`));
      if (!typeSnap.exists || !typeSnap.data().hasTeams) throw new HttpError(400, "Il campionato non è a squadre.");

      const entryRef = db.doc(`editionTeams/${editionTeamId}`);
      const entrySnap = await t.get(entryRef);
      if (!entrySnap.exists) throw new HttpError(404, "Voce di classifica non trovata.");
      const entry = entrySnap.data();
      if (entry.editionId !== editionId) throw new HttpError(400, "La voce non appartiene a questa edizione.");
      const teamId = entry.teamId;

      const [asTeam1Snap, asTeam2Snap] = await Promise.all([
        t.get(db.collection("matches").where("editionId", "==", editionId).where("team1Id", "==", teamId)),
        t.get(db.collection("matches").where("editionId", "==", editionId).where("team2Id", "==", teamId)),
      ]);
      const involvedMatches = [...asTeam1Snap.docs, ...asTeam2Snap.docs];

      const matchChanges = [];
      if (newStatus !== "normale") {
        for (const matchDoc of involvedMatches) {
          const match = matchDoc.data();
          const change = applyPolicyToMatch(match, teamId, policy);
          if (change) matchChanges.push({ ref: matchDoc.ref, before: match, change });
        }
      }

      // Rilegge TUTTE le partite dell'edizione per il ricalcolo, applicando in memoria
      // le modifiche decise sopra prima di calcolare i nuovi totali.
      const allMatchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
      const changedById = new Map(matchChanges.map((c) => [c.ref.id, c.change]));
      const allMatchesAfter = allMatchesSnap.docs.map((d) => {
        const data = d.data();
        const change = changedById.get(d.id);
        return change ? { ...data, status: change.status, result: change.result ?? undefined } : data;
      });

      const editionTeamsSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));
      const standingsUpdates = computeStandingsUpdates(editionTeamsSnap.docs, allMatchesAfter);

      for (const c of matchChanges) {
        t.update(c.ref, {
          status: c.change.status,
          result: c.change.result ?? admin.firestore.FieldValue.delete(),
          updatedAt: timestamp,
          updatedBy: auth.uid,
        });
      }
      t.update(entryRef, { status: newStatus });
      for (const u of standingsUpdates) t.update(u.ref, u.data);

      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "team_status_changed",
        detail: JSON.stringify({ role: auth.role, editionId, editionTeamId, teamId, newStatus, policy: policy ?? null }),
        before: { status: entry.status },
        after: { status: newStatus, matchesChanged: matchChanges.length },
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
    res.status(500).json({ error: "Errore interno nel cambio di stato" });
  }
}
