// Funzione serverless (Vercel). Fase 2 — unico motore di ricalcolo della classifica:
// non esiste (e non deve esistere) un secondo motore lato frontend. Il frontend può
// chiedere una preview (dryRun: true, nessuna scrittura) o il ricalcolo definitivo
// (dryRun: false/assente), sempre calcolato qui.
//
// Body atteso: { editionId: string, dryRun?: boolean }

import admin from "firebase-admin";
import { roleAllowed } from "../_lib/roles.js";
import { enqueueNotificationEvent } from "../_lib/notificationEvents.js";
import { computeStandingsUpdates } from "../_lib/standingsRules.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

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
  if (!roleAllowed(callerData.role, ["superAdmin"])) {
    throw new HttpError(403, "Solo admin o superAdmin possono ricalcolare la classifica");
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

    const input = parseBody(z.object({
      editionId: documentId,
      dryRun: z.boolean().optional(),
      idempotencyKey: z.string().trim().max(120).optional(),
    }).strict(), req.body);
    const { editionId, dryRun } = input;
    if (!editionId) throw new HttpError(400, "editionId mancante");

    const editionRef = db.doc(`championshipEditions/${editionId}`);
    const editionSnap = await editionRef.get();
    if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
    const edition = editionSnap.data();
    const typeSnap = await db.doc(`championshipTypes/${edition.typeId}`).get();
    const type = typeSnap.exists ? typeSnap.data() : null;
    if (!type || !type.hasTeams) {
      throw new HttpError(400, "Il campionato non è a squadre.");
    }

    if (dryRun) {
      const [matchesSnap, editionTeamsSnap] = await Promise.all([
        db.collection("matches").where("editionId", "==", editionId).get(),
        db.collection("editionTeams").where("editionId", "==", editionId).get(),
      ]);
      const updates = computeStandingsUpdates(editionTeamsSnap.docs, matchesSnap.docs.map((d) => d.data()));
      const changed = updates.filter((u) => u.fromPoints !== u.toPoints || u.fromPlayed !== u.toPlayed);
      res.status(200).json({
        ok: true,
        preview: changed.map((u) => ({
          teamId: u.teamId,
          fromPoints: u.fromPoints,
          toPoints: u.toPoints,
          fromPlayed: u.fromPlayed,
          toPlayed: u.toPlayed,
        })),
      });
      return;
    }

    // Commit definitivo: legge SEMPRE dati freschi dentro la stessa transazione che
    // scrive, per proteggere da scritture concorrenti (es. un risultato salvato nello
    // stesso istante da un altro utente) — non riusa la lettura precedente.
    const timestamp = new Date().toISOString();
    let appliedChanges = [];
    await db.runTransaction(async (t) => {
      const [freshMatchesSnap, freshEditionTeamsSnap] = await Promise.all([
        t.get(db.collection("matches").where("editionId", "==", editionId)),
        t.get(db.collection("editionTeams").where("editionId", "==", editionId)),
      ]);
      const freshUpdates = computeStandingsUpdates(
        freshEditionTeamsSnap.docs,
        freshMatchesSnap.docs.map((d) => d.data())
      );
      const freshChanged = freshUpdates.filter((u) => u.fromPoints !== u.toPoints || u.fromPlayed !== u.toPlayed);
      appliedChanges = freshChanged.map((u) => ({
        teamId: u.teamId,
        fromPoints: u.fromPoints,
        toPoints: u.toPoints,
        fromPlayed: u.fromPlayed,
        toPlayed: u.toPlayed,
      }));

      for (const u of freshUpdates) t.update(u.ref, u.data);
      t.update(editionRef, { lastRecalculatedAt: timestamp });
      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "standings_recalculated",
        detail: JSON.stringify({ role: auth.role, editionId, changedCount: freshChanged.length }),
        before: null,
        after: { changedCount: freshChanged.length },
        timestamp,
      });
    });

    let notification = null;
    if (appliedChanges.length > 0) {
      try {
        notification = await enqueueNotificationEvent(
          app,
          {
            type: "standings_update",
            title: "Classifica aggiornata",
            body: `${type.name} ${edition.season}: ${appliedChanges.length} righe aggiornate.`,
            url: `/campionati/${editionId}`,
            editionId,
          },
          {
            createdBy: auth.uid,
            idempotencyKey: input.idempotencyKey || `standings-${editionId}-${timestamp}`,
            sourceRef: `championshipEditions/${editionId}`,
          }
        );
      } catch (notificationErr) {
        console.error("Errore notifica classifica", notificationErr);
      }
    }

    res.status(200).json({ ok: true, applied: appliedChanges, notification });
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
    res.status(500).json({ error: "Errore interno durante il ricalcolo" });
  }
}
