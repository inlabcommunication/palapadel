import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const badgeColor = z.string().trim().min(1).max(40);
const status = z.enum(["bozza", "attiva", "conclusa", "nascosta"]);
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("createType"),
    id: documentId,
    name: z.string().trim().min(2).max(100),
    hasTeams: z.boolean(),
    badgeColor,
  }).strict(),
  z.object({
    operation: z.literal("updateType"),
    id: documentId,
    name: z.string().trim().min(2).max(100),
    hasTeams: z.boolean(),
    badgeColor,
  }).strict(),
  z.object({
    operation: z.literal("setTypeLogo"),
    id: documentId,
    logoUrl: z.string().url().max(2000),
    logoStoragePath: z.string().trim().min(3).max(1000),
    logoAlt: z.string().trim().min(1).max(200),
  }).strict(),
  z.object({ operation: z.literal("removeTypeLogo"), id: documentId }).strict(),
  z.object({ operation: z.literal("deleteType"), id: documentId }).strict(),
  z.object({
    operation: z.literal("createEdition"),
    typeId: documentId,
    season: z.string().trim().min(1).max(50),
    status,
  }).strict(),
  z.object({
    operation: z.literal("updateEdition"),
    editionId: documentId,
    typeId: documentId,
    season: z.string().trim().min(1).max(50),
    status: z.enum(["bozza", "attiva", "nascosta"]),
  }).strict(),
  z.object({ operation: z.literal("deleteEdition"), editionId: documentId }).strict(),
]);

export function resolveEditionVisibility(beforeStatus, beforeVisibility, nextStatus) {
  if (nextStatus === "nascosta" || nextStatus === "bozza") return false;
  if (nextStatus === "attiva" && beforeStatus !== "attiva") return true;
  return beforeVisibility === true;
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    let createdId;

    await db.runTransaction(async (transaction) => {
      let entity;
      let before = null;
      let after = null;

      if (input.operation === "setTypeLogo" || input.operation === "removeTypeLogo") {
        const ref = db.doc(`championshipTypes/${input.id}`);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new HttpError(404, "Tipologia non trovata");
        before = snap.data();
        const logoData = input.operation === "setTypeLogo"
          ? {
              logoUrl: input.logoUrl,
              logoStoragePath: input.logoStoragePath,
              logoAlt: input.logoAlt,
              updatedAt: timestamp,
            }
          : {
              logoUrl: admin.firestore.FieldValue.delete(),
              logoStoragePath: admin.firestore.FieldValue.delete(),
              logoAlt: admin.firestore.FieldValue.delete(),
              updatedAt: timestamp,
            };
        transaction.update(ref, logoData);
        after = input.operation === "setTypeLogo"
          ? { ...before, ...logoData }
          : { ...before, logoUrl: null, logoStoragePath: null, logoAlt: null, updatedAt: timestamp };
        entity = `championshipTypes/${input.id}`;
      } else if (input.operation === "createType" || input.operation === "updateType") {
        const ref = db.doc(`championshipTypes/${input.id}`);
        const snap = await transaction.get(ref);
        before = snap.exists ? snap.data() : null;
        if (input.operation === "createType" && snap.exists) throw new HttpError(409, "Tipologia gia esistente");
        after = {
          id: input.id,
          name: input.name,
          hasTeams: input.hasTeams,
          badgeColor: input.badgeColor,
          ...(input.operation === "createType" ? { displayOrder: Date.now() } : {}),
        };
        transaction.set(ref, after, { merge: input.operation === "updateType" });
        entity = `championshipTypes/${input.id}`;
      } else if (input.operation === "deleteType") {
        const ref = db.doc(`championshipTypes/${input.id}`);
        const [snap, used] = await Promise.all([
          transaction.get(ref),
          transaction.get(db.collection("championshipEditions").where("typeId", "==", input.id).limit(1)),
        ]);
        if (!snap.exists) throw new HttpError(404, "Tipologia non trovata");
        if (!used.empty) throw new HttpError(409, "La tipologia e usata da almeno un'edizione");
        before = snap.data();
        transaction.delete(ref);
        if (before.logoStoragePath) {
          transaction.set(db.collection("storageCleanupQueue").doc(), {
            storagePath: before.logoStoragePath,
            reason: "Logo di una tipologia eliminata",
            status: "pending",
            attempts: 0,
            createdAt: timestamp,
            createdBy: caller.uid,
          });
        }
        entity = `championshipTypes/${input.id}`;
      } else if (input.operation === "createEdition") {
        const typeSnap = await transaction.get(db.doc(`championshipTypes/${input.typeId}`));
        if (!typeSnap.exists) throw new HttpError(404, "Tipologia non trovata");
        const duplicate = await transaction.get(
          db.collection("championshipEditions")
            .where("typeId", "==", input.typeId)
            .where("season", "==", input.season)
            .limit(1)
        );
        if (!duplicate.empty) throw new HttpError(409, "Edizione gia esistente");
        const ref = db.collection("championshipEditions").doc();
        createdId = ref.id;
        after = {
          id: ref.id,
          typeId: input.typeId,
          season: input.season,
          status: input.status,
          displayOrder: Date.now(),
          isPubliclyVisible: input.status === "attiva",
          createdAt: timestamp,
        };
        transaction.set(ref, after);
        entity = `championshipEditions/${ref.id}`;
      } else if (input.operation === "updateEdition") {
        const ref = db.doc(`championshipEditions/${input.editionId}`);
        const [snap, typeSnap] = await Promise.all([
          transaction.get(ref),
          transaction.get(db.doc(`championshipTypes/${input.typeId}`)),
        ]);
        if (!snap.exists) throw new HttpError(404, "Edizione non trovata");
        if (!typeSnap.exists) throw new HttpError(404, "Tipologia non trovata");
        before = snap.data();
        const isPubliclyVisible = resolveEditionVisibility(
          before.status,
          before.isPubliclyVisible,
          input.status
        );
        after = {
          ...before,
          typeId: input.typeId,
          season: input.season,
          status: input.status,
          isPubliclyVisible,
          updatedAt: timestamp,
        };
        transaction.update(ref, {
          typeId: input.typeId,
          season: input.season,
          status: input.status,
          isPubliclyVisible,
          updatedAt: timestamp,
        });
        entity = `championshipEditions/${input.editionId}`;
      } else {
        const ref = db.doc(`championshipEditions/${input.editionId}`);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new HttpError(404, "Edizione non trovata");
        const dependentCollections = ["editionTeams", "femaleParticipants", "matchdays", "matches"];
        for (const collectionName of dependentCollections) {
          const dependent = await transaction.get(
            db.collection(collectionName).where("editionId", "==", input.editionId).limit(1)
          );
          if (!dependent.empty) throw new HttpError(409, "L'edizione contiene dati e non puo essere eliminata");
        }
        before = snap.data();
        transaction.delete(ref);
        entity = `championshipEditions/${input.editionId}`;
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: `championship_${input.operation}`,
        entity,
        before,
        after,
        detail: JSON.stringify({ role: caller.role }),
        timestamp,
      });
    });

    res.status(200).json({ ok: true, ...(createdId ? { id: createdId } : {}) });
  } catch (error) {
    sendError(res, error, "Errore nella gestione del campionato");
  }
}
