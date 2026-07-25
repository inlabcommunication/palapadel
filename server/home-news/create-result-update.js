// Funzione serverless (Vercel). Fase 6 — crea la bozza di notizia Home dopo uno o più
// risultati come UNICA transazione: partita/e, notizia e audit log insieme. Il frontend
// non scrive più direttamente su homeNews né su matches per questo flusso.
//
// Body atteso: { matchIds: string[], editionId: string, matchdayId: string, typeName: string, season: string }
//
// Verifica che ogni partita sia "conclusa", evita di creare una doppia bozza per una
// partita che ne ha già una (notificationStatus già "draft" o "sent"), crea UNA notizia
// Home in bozza che copre tutte le partite passate, e aggiorna ciascuna partita con
// notificationStatus="draft", notificationDraftCreatedAt, notificationNewsId,
// notificationSentAt=null. Non dichiara mai un invio reale.

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
  // Fase 6/14 — solo admin/superAdmin creano aggiornamenti Home: il resultManager non
  // è autorizzato (non ha permessi di scrittura su homeNews).
  if (!["superadmin", "admin"].includes(callerData.role)) {
    throw new HttpError(403, "Solo admin o superAdmin possono creare un aggiornamento Home");
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

    const { matchIds, editionId, matchdayId, typeName, season } = req.body || {};
    if (!Array.isArray(matchIds) || matchIds.length === 0 || !editionId || !matchdayId) {
      throw new HttpError(400, "Dati mancanti");
    }

    const timestamp = new Date().toISOString();
    const newsRef = db.collection("homeNews").doc();

    await db.runTransaction(async (t) => {
      const matchRefs = matchIds.map((id) => db.doc(`matches/${id}`));
      const matchSnaps = await Promise.all(matchRefs.map((r) => t.get(r)));

      const teamsSnap = await t.get(db.collection("teams"));
      const teamNameById = new Map(teamsSnap.docs.map((d) => [d.id, d.data().name]));

      const invalid = [];
      const matches = [];
      matchSnaps.forEach((snap, i) => {
        if (!snap.exists) {
          invalid.push(`${matchIds[i]}: partita non trovata`);
          return;
        }
        const data = snap.data();
        if (data.editionId !== editionId || data.matchdayId !== matchdayId) {
          invalid.push(`${matchIds[i]}: non appartiene a questa giornata/edizione`);
          return;
        }
        if (data.status !== "conclusa" || !data.result) {
          invalid.push(`${matchIds[i]}: la partita non è conclusa, non può generare un aggiornamento`);
          return;
        }
        // Fase 6 — evita doppie bozze: se esiste già un aggiornamento non fallito per
        // questa partita, non permettere di crearne un altro.
        if (data.notificationStatus === "draft" || data.notificationStatus === "sent") {
          invalid.push(`${matchIds[i]}: esiste già un aggiornamento Home per questa partita`);
          return;
        }
        matches.push({ ref: matchRefs[i], data });
      });

      if (invalid.length > 0) {
        throw new HttpError(400, invalid.join(" "));
      }

      const lines = matches
        .map((m) => `${teamNameById.get(m.data.team1Id) ?? "—"} ${m.data.result} ${teamNameById.get(m.data.team2Id) ?? "—"}`)
        .join("\n");
      const title = matches.length === 1 ? `Risultato — ${typeName ?? ""}`.trim() : `Risultati giornata — ${typeName ?? ""}`.trim();

      t.set(newsRef, {
        title,
        body: `${typeName ?? ""} ${season ?? ""}:\n${lines}`.trim(),
        date: timestamp,
        status: "bozza",
      });

      for (const m of matches) {
        t.update(m.ref, {
          notificationStatus: "draft",
          notificationDraftCreatedAt: timestamp,
          notificationNewsId: newsRef.id,
          notificationSentAt: null,
        });
      }

      t.set(db.collection("auditLog").doc(), {
        actor: auth.uid,
        action: "home_news_draft_created",
        detail: JSON.stringify({ role: auth.role, editionId, matchdayId, matchIds, newsId: newsRef.id }),
        before: null,
        after: { newsId: newsRef.id, matchIds },
        timestamp,
      });
    });

    res.status(200).json({ ok: true, newsId: newsRef.id });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno nella creazione dell'aggiornamento Home" });
  }
}
