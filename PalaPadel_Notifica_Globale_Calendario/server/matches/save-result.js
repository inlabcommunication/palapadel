// Funzione serverless (Vercel, non Firebase — coerente con il piano Spark del progetto).
//
// Flusso RISULTATO -> SALVATAGGIO PARTITA -> RICALCOLO CLASSIFICA -> AUDIT LOG, come
// UNICA transazione Firestore atomica: se una qualsiasi verifica o scrittura fallisce,
// nessuna delle altre viene applicata (mai partita salvata con classifica non aggiornata).
// Le transazioni Firestore gestiscono anche la concorrenza: se due richieste toccano
// contemporaneamente gli stessi documenti editionTeams, una viene rieseguita
// automaticamente con dati freschi (nessun aggiornamento perso, vedi Scenario 8).
//
// Configurazione richiesta (vedi README): variabile d'ambiente FIREBASE_SERVICE_ACCOUNT
// su Vercel con il JSON della chiave di servizio.
//
// Body atteso:
//   { matchId: string, result: "2-0"|"2-1"|"1-2"|"0-2" }             -> conclude la partita
//   { matchId: string, status: "rinviata"|"annullata"|"da_giocare" } -> cambia stato, rimuove
//                                                                       un eventuale risultato

import admin from "firebase-admin";
import { normalizeMatchChange, RESULT_VALUES } from "../_lib/matchStatus.js";
import { enqueueNotificationEvent } from "../_lib/notificationEvents.js";
import { computeStandingsUpdates } from "../_lib/standingsRules.js";
import { normalizeRole, roleAllowed } from "../_lib/roles.js";
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

/** Fase 2 — verifica token, ruolo e che l'utente non sia disattivato. */
async function verifyCaller(app, req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) throw new HttpError(401, "Token mancante");

  const decoded = await admin.auth(app).verifyIdToken(idToken);
  const callerSnap = await admin.firestore(app).doc(`users/${decoded.uid}`).get();
  if (!callerSnap.exists) throw new HttpError(403, "Utente non registrato");
  const callerData = callerSnap.data();
  if (callerData.disabled) throw new HttpError(403, "Account disattivato");
  const role = callerData.role;
  if (!roleAllowed(role, ["superAdmin", "admin", "resultManager"])) {
    throw new HttpError(403, "Permessi insufficienti");
  }
  return { uid: decoded.uid, role: normalizeRole(role) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const auth = await verifyCaller(app, req).catch((err) => {
      throw err instanceof HttpError ? err : new HttpError(401, "Token non valido");
    });

    const { matchId, result, status } = parseBody(z.union([
      z.object({ matchId: documentId, result: z.enum(["2-0", "2-1", "1-2", "0-2"]) }).strict(),
      z.object({ matchId: documentId, status: z.enum(["rinviata", "annullata", "da_giocare"]) }).strict(),
    ]), req.body);

    const normalized = normalizeMatchChange({ result, status });
    if (!normalized.ok) {
      throw new HttpError(400, `${normalized.error}. Risultati ammessi: ${RESULT_VALUES.join(", ")}`);
    }

    const db = admin.firestore(app);
    const matchRef = db.doc(`matches/${matchId}`);

    const auditRef = db.collection("auditLog").doc();
    const updatedAt = new Date().toISOString();
    let notificationEvent = null;

    await db.runTransaction(async (t) => {
      const matchSnap = await t.get(matchRef);
      if (!matchSnap.exists) throw new HttpError(404, "Partita non trovata");
      const before = matchSnap.data();
      const editionId = before.editionId;

      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const editionSnap = await t.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      const edition = editionSnap.data();

      const typeSnap = await t.get(db.doc(`championshipTypes/${edition.typeId}`));
      const type = typeSnap.exists ? typeSnap.data() : null;
      if (!type || !type.hasTeams) {
        throw new HttpError(400, "Il campionato non è a squadre: le partite/giornate non si applicano.");
      }

      // Fase 2 — il resultManager non può operare su edizioni concluse, nascoste o in
      // bozza. Admin e superAdmin possono correggere anche lì, ma restano comunque
      // soggetti a tutte le altre validazioni (nessun bypass sui dati).
      if (auth.role === "resultManager" && edition.status !== "attiva") {
        throw new HttpError(403, "Il resultManager può operare solo su edizioni attive.");
      }

      const newStatus = normalized.status;
      const newResult = normalized.result === null ? admin.firestore.FieldValue.delete() : normalized.result;

      // Fase 3 — rilegge/ricalcola SEMPRE tutte le partite valide dell'edizione dentro la
      // stessa transazione, mai una somma incrementale sul singolo risultato.
      const matchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
      const editionTeamsSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));

      const allMatches = matchesSnap.docs.map((d) => {
        const data = d.data();
        if (d.id === matchId) return { ...data, status: newStatus, result: normalized.result ?? undefined };
        return data;
      });
      const standingsUpdates = computeStandingsUpdates(editionTeamsSnap.docs, allMatches);

      const actionType = normalized.result
        ? before.status === "conclusa" && before.result
          ? "result_corrected"
          : "result_created"
        : { rinviata: "match_postponed", annullata: "match_cancelled", da_giocare: "match_reopened" }[newStatus];

      if (normalized.result) {
        const [team1Snap, team2Snap] = await Promise.all([
          t.get(db.doc(`teams/${before.team1Id}`)),
          t.get(db.doc(`teams/${before.team2Id}`)),
        ]);
        const team1Name = team1Snap.exists ? team1Snap.data().name : "Squadra 1";
        const team2Name = team2Snap.exists ? team2Snap.data().name : "Squadra 2";
        const eventType = actionType === "result_corrected" ? "correction" : "match_result";
        notificationEvent = {
          type: eventType,
          title: eventType === "correction" ? "Risultato corretto" : "Risultato partita",
          body: `${team1Name} ${normalized.result} ${team2Name}`,
          url: `/campionati/${editionId}`,
          editionId,
        };
      }

      t.update(matchRef, { status: newStatus, result: newResult, updatedAt, updatedBy: auth.uid });
      for (const u of standingsUpdates) t.update(u.ref, u.data);
      t.update(editionRef, {
        lastRecalculatedAt: updatedAt,
        ...(normalized.result ? { activeMatchdayId: before.matchdayId } : {}),
      });

      t.set(auditRef, {
        actor: auth.uid,
        action: actionType,
        detail: JSON.stringify({ role: auth.role, editionId, matchdayId: before.matchdayId, matchId }),
        before: { status: before.status, result: before.result ?? null },
        after: { status: newStatus, result: normalized.result },
        timestamp: updatedAt,
      });
    });

    let notification = null;
    if (notificationEvent) {
      try {
        notification = await enqueueNotificationEvent(app, notificationEvent, {
          createdBy: auth.uid,
          idempotencyKey: `match-${matchId}-${notificationEvent.type}-${normalized.result}`,
          sourceRef: `matches/${matchId}`,
        });
        const notificationStatus =
          notification.status === "sent"
            ? "sent"
            : notification.status === "failed"
              ? "failed"
              : notification.status === "none" || notification.status === "skipped"
                ? "none"
                : "draft";
        await matchRef.set(
          {
            notificationStatus,
            notificationDraftId: notification.draftId ?? null,
            notificationDraftCreatedAt: notification.draftId ? new Date().toISOString() : null,
            notificationSentAt: notification.status === "sent" ? new Date().toISOString() : null,
            notificationError: notification.status === "failed" ? "Invio notifica fallito" : null,
          },
          { merge: true }
        );
      } catch (notificationErr) {
        console.error("Errore notifica risultato", notificationErr);
        await matchRef.set(
          {
            notificationStatus: "failed",
            notificationError: notificationErr.message || "Errore notifica",
          },
          { merge: true }
        );
      }
    }

    res.status(200).json({ ok: true, notification });
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
    res.status(500).json({ error: "Errore interno durante il salvataggio del risultato" });
  }
}
