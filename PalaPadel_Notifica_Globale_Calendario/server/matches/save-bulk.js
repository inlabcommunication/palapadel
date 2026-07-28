// Funzione serverless (Vercel). Fase 4/11: aggiornamento massivo di una giornata come
// UNICA transazione Firestore atomica - valida tutte le partite prima di scrivere, e se
// anche una sola voce non è valida non salva nulla parzialmente. Ricalcola la classifica
// una sola volta. Stesso pattern di api/matches/save-result.js.
//
// Body atteso: { matchdayId, editionId, entries: [{ matchId, result, status }] }
// status API: "scheduled"|"completed"|"postponed"|"cancelled".
// result: null salvo status "completed", dove deve essere uno tra "2-0"|"2-1"|"1-2"|"0-2".
// Per compatibilita accetta anche i vecchi stati Firestore italiani e li normalizza.
// Permette quindi, nella stessa chiamata, di inserire risultati, correggerli, rinviare,
// annullare e riaprire più partite della stessa giornata - anche quelle già concluse.

import admin from "firebase-admin";
import { normalizeMatchChange } from "../_lib/matchStatus.js";
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
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
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
    const auth = await verifyCaller(app, req);

    const input = parseBody(z.object({
      matchdayId: documentId,
      editionId: documentId,
      entries: z.array(z.object({
        matchId: documentId,
        result: z.enum(["2-0", "2-1", "1-2", "0-2"]).nullable(),
        status: z.enum(["scheduled", "completed", "postponed", "cancelled", "da_giocare", "conclusa", "rinviata", "annullata"]),
      }).strict()).min(1).max(200),
      idempotencyKey: z.string().trim().max(120).optional(),
    }).strict(), req.body);
    const { matchdayId, editionId, entries } = input;
    if (!matchdayId || !editionId || !Array.isArray(entries) || entries.length === 0) {
      throw new HttpError(400, "Dati mancanti");
    }
    const missingIds = entries
      .map((entry, index) => (!entry?.matchId ? `Riga ${index + 1}: matchId mancante` : null))
      .filter(Boolean);
    if (missingIds.length > 0) {
      throw new HttpError(400, "Alcune partite non sono valide, nessun dato è stato salvato.", missingIds);
    }

    const db = admin.firestore(app);
    const updatedAt = new Date().toISOString();
    const auditRef = db.collection("auditLog").doc();
    let notificationEvent = null;

    await db.runTransaction(async (t) => {
      const editionRef = db.doc(`championshipEditions/${editionId}`);
      const editionSnap = await t.get(editionRef);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      const edition = editionSnap.data();
      if (edition.status !== "attiva") {
        throw new HttpError(400, "L'edizione deve essere attiva per aggiornare una giornata.");
      }

      const typeSnap = await t.get(db.doc(`championshipTypes/${edition.typeId}`));
      const type = typeSnap.exists ? typeSnap.data() : null;
      if (!type || !type.hasTeams) {
        throw new HttpError(400, "Il campionato non è a squadre.");
      }
      if (auth.role === "resultManager" && edition.status !== "attiva") {
        throw new HttpError(403, "Il resultManager può operare solo su edizioni attive.");
      }

      const matchRefs = entries.map((e) => db.doc(`matches/${e.matchId}`));
      const matchSnaps = await Promise.all(matchRefs.map((r) => t.get(r)));

      // Fase 4/9 - valida TUTTO prima di scrivere qualsiasi cosa.
      const invalidEntries = [];
      const normalizedEntries = [];
      matchSnaps.forEach((snap, i) => {
        const { matchId } = entries[i];
        const normalized = normalizeMatchChange(entries[i]);
        if (!snap.exists) {
          invalidEntries.push(`${matchId}: partita non trovata`);
          return;
        }
        const data = snap.data();
        if (data.matchdayId !== matchdayId) invalidEntries.push(`${matchId}: non appartiene a questa giornata`);
        if (data.editionId !== editionId) invalidEntries.push(`${matchId}: non appartiene a questa edizione`);
        if (!normalized.ok) {
          invalidEntries.push(`${matchId}: ${normalized.error}`);
          return;
        }
        normalizedEntries.push({
          matchId,
          ref: matchRefs[i],
          before: data,
          newStatus: normalized.status,
          newResult: normalized.result,
        });
      });
      if (invalidEntries.length > 0) {
        throw new HttpError(400, "Alcune partite non sono valide, nessun dato è stato salvato.", invalidEntries);
      }

      const completedCount = normalizedEntries.filter((e) => e.newStatus === "conclusa" && e.newResult).length;
      if (completedCount > 0) {
        notificationEvent = {
          type: "match_result",
          title: "Giornata aggiornata",
          body: `${completedCount} risultati salvati.`,
          url: `/campionati/${editionId}`,
          editionId,
        };
      }

      const matchesSnap = await t.get(db.collection("matches").where("editionId", "==", editionId));
      const editionTeamsSnap = await t.get(db.collection("editionTeams").where("editionId", "==", editionId));

      const changeByMatchId = new Map(normalizedEntries.map((e) => [e.matchId, e]));
      const allMatches = matchesSnap.docs.map((d) => {
        const data = d.data();
        const change = changeByMatchId.get(d.id);
        if (change) return { ...data, status: change.newStatus, result: change.newResult ?? undefined };
        return data;
      });

      // Fase 4/11: un solo ricalcolo per l'intera giornata, non uno per partita.
      const standingsUpdates = computeStandingsUpdates(editionTeamsSnap.docs, allMatches);

      for (const e of normalizedEntries) {
        t.update(e.ref, {
          status: e.newStatus,
          result: e.newResult ?? admin.firestore.FieldValue.delete(),
          updatedAt,
          updatedBy: auth.uid,
        });
      }
      for (const u of standingsUpdates) t.update(u.ref, u.data);
      t.update(editionRef, { lastRecalculatedAt: updatedAt });

      t.set(auditRef, {
        actor: auth.uid,
        action: "bulk_matchday_update",
        detail: JSON.stringify({ role: auth.role, editionId, matchdayId }),
        before: normalizedEntries.map((e) => ({ matchId: e.matchId, status: e.before.status, result: e.before.result ?? null })),
        after: normalizedEntries.map((e) => ({ matchId: e.matchId, status: e.newStatus, result: e.newResult })),
        timestamp: updatedAt,
      });
    });

    let notification = null;
    if (notificationEvent) {
      try {
        notification = await enqueueNotificationEvent(app, notificationEvent, {
          createdBy: auth.uid,
          idempotencyKey: input.idempotencyKey || `bulk-${matchdayId}-${updatedAt}`,
          sourceRef: `matchdays/${matchdayId}`,
        });
      } catch (notificationErr) {
        console.error("Errore notifica giornata", notificationErr);
      }
    }

    res.status(200).json({ ok: true, saved: entries.length, notification });
  } catch (err) {
    if (err?.details?.code === "VALIDATION_ERROR") {
      res.status(err.status ?? 400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message, fields: err.details.fields ?? {} } });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante il salvataggio massivo" });
  }
}
