import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { computeStandingsUpdates } from "../_lib/standingsRules.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const MATCH_ACTIONS = new Set(["result_created", "result_corrected", "match_postponed", "match_cancelled", "match_reopened"]);

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { auditId } = parseBody(z.object({ auditId: documentId }).strict(), req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const auditRef = db.doc(`auditLog/${auditId}`);
      const auditSnap = await transaction.get(auditRef);
      if (!auditSnap.exists) throw new HttpError(404, "Operazione audit non trovata");
      const audit = auditSnap.data();
      if (audit.undoneAt) throw new HttpError(409, "Questa operazione è già stata annullata");
      const detail = parseDetail(audit.detail);

      if (MATCH_ACTIONS.has(audit.action)) {
        const matchId = detail.matchId;
        if (!matchId) throw new HttpError(400, "L'audit non contiene la partita da ripristinare");
        const matchRef = db.doc(`matches/${matchId}`);
        const matchSnap = await transaction.get(matchRef);
        if (!matchSnap.exists) throw new HttpError(404, "Partita non trovata");
        const current = matchSnap.data();
        assertCurrentMatches(current, audit.after, ["status", "result"]);

        const matchesSnap = await transaction.get(db.collection("matches").where("editionId", "==", current.editionId));
        const entriesSnap = await transaction.get(db.collection("editionTeams").where("editionId", "==", current.editionId));
        const restoredMatches = matchesSnap.docs.map((doc) =>
          doc.id === matchId ? { ...doc.data(), ...audit.before } : doc.data()
        );
        const updates = computeStandingsUpdates(entriesSnap.docs, restoredMatches);
        transaction.update(matchRef, {
          status: audit.before.status,
          result: audit.before.result ?? admin.firestore.FieldValue.delete(),
          updatedAt: timestamp,
          updatedBy: caller.uid,
        });
        updates.forEach((update) => transaction.update(update.ref, update.data));
      } else if (audit.action === "championship_visibility_changed") {
        const editionId = String(audit.entity ?? "").split("/").pop();
        if (!editionId) throw new HttpError(400, "Campionato non identificabile");
        const ref = db.doc(`championshipEditions/${editionId}`);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpError(404, "Campionato non trovato");
        assertCurrentMatches(snapshot.data(), audit.after, ["isPubliclyVisible"]);
        transaction.update(ref, { isPubliclyVisible: audit.before.isPubliclyVisible });
      } else if (audit.action === "championships_reordered" || audit.action === "championship_types_reordered") {
        if (!Array.isArray(audit.before) || !Array.isArray(audit.after)) throw new HttpError(400, "Audit ordine non valido");
        const collectionName = audit.action === "championship_types_reordered" ? "championshipTypes" : "championshipEditions";
        const refs = audit.after.map((item) => db.doc(`${collectionName}/${item.id}`));
        const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
        snapshots.forEach((snapshot, index) => {
          if (!snapshot.exists) throw new HttpError(404, "Un campionato non esiste più");
          assertCurrentMatches(snapshot.data(), audit.after[index], ["displayOrder"]);
        });
        audit.before.forEach((item) => {
          const ref = db.doc(`${collectionName}/${item.id}`);
          transaction.update(ref, {
            displayOrder: item.displayOrder === null ? admin.firestore.FieldValue.delete() : item.displayOrder,
          });
        });
      } else if (audit.action === "home_news_updated") {
        const newsId = String(audit.entity ?? "").split("/").pop();
        if (!newsId || !audit.before) throw new HttpError(400, "News non identificabile");
        const ref = db.doc(`homeNews/${newsId}`);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpError(404, "News non trovata");
        const expectedFields = Object.keys(audit.after ?? {}).filter((key) => !["operation", "newsId"].includes(key));
        assertCurrentMatches(snapshot.data(), audit.after, expectedFields);
        const currentImage = snapshot.data().imageStoragePath;
        const previousImage = audit.before.imageStoragePath;
        transaction.set(ref, audit.before);
        if (currentImage && currentImage !== previousImage) {
          transaction.set(db.collection("storageCleanupQueue").doc(), {
            storagePath: currentImage,
            reason: "Immagine sostituita rimasta dopo annullamento News",
            status: "pending",
            attempts: 0,
            createdAt: timestamp,
            createdBy: caller.uid,
          });
        }
      } else if (audit.action === "team_updated") {
        const teamId = String(audit.entity ?? "").split("/").pop();
        if (!teamId || !audit.before) throw new HttpError(400, "Squadra non identificabile");
        const ref = db.doc(`teams/${teamId}`);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpError(404, "Squadra non trovata");
        const expectedFields = Object.keys(audit.after ?? {}).filter((key) => !["operation", "teamId"].includes(key));
        assertCurrentMatches(snapshot.data(), audit.after, expectedFields);
        const currentPhoto = snapshot.data().teamPhotoStoragePath;
        const previousPhoto = audit.before.teamPhotoStoragePath;
        transaction.set(ref, audit.before);
        if (currentPhoto && currentPhoto !== previousPhoto) {
          transaction.set(db.collection("storageCleanupQueue").doc(), {
            storagePath: currentPhoto,
            reason: "Foto sostituita rimasta dopo annullamento squadra",
            status: "pending",
            attempts: 0,
            createdAt: timestamp,
            createdBy: caller.uid,
          });
        }
      } else {
        throw new HttpError(400, "Questa operazione non è annullabile in sicurezza");
      }

      transaction.update(auditRef, { undoneAt: timestamp, undoneBy: caller.uid });
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "operation_undone",
        entity: audit.entity ?? null,
        detail: JSON.stringify({ sourceAuditId: auditId, sourceAction: audit.action }),
        before: audit.after,
        after: audit.before,
        timestamp,
      });
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore durante l'annullamento dell'operazione");
  }
}

function parseDetail(detail) {
  if (detail && typeof detail === "object") return detail;
  try {
    return JSON.parse(detail || "{}");
  } catch {
    return {};
  }
}

function assertCurrentMatches(current, expected, fields) {
  if (!expected || fields.some((field) => (current[field] ?? null) !== (expected[field] ?? null))) {
    throw new HttpError(409, "Lo stato è cambiato dopo questa operazione: annullamento bloccato");
  }
}
