import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const content = {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  category: z.string().trim().max(100).optional(),
  status: z.enum(["bozza", "pubblicato"]),
  imageUrl: z.string().url().max(2000).optional(),
  imageStoragePath: z.string().trim().max(1000).optional(),
  imageAlt: z.union([z.string().trim().max(300), z.null()]).optional(),
  imagePositionY: z.number().min(0).max(100).optional(),
  imageScale: z.number().min(1).max(2).optional(),
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), newsId: documentId, date: z.string().datetime().optional(), ...content }).strict(),
  z.object({ operation: z.literal("update"), newsId: documentId, ...content }).strict(),
  z.object({ operation: z.literal("removeImage"), newsId: documentId }).strict(),
]);

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const ref = db.doc(`homeNews/${input.newsId}`);
    const timestamp = new Date().toISOString();
    let previousImagePath = null;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const before = snapshot.exists ? snapshot.data() : null;
      if (input.operation === "create" && snapshot.exists) throw new HttpError(409, "La news esiste già");
      if (input.operation !== "create" && !snapshot.exists) throw new HttpError(404, "News non trovata");

      if (input.operation === "removeImage") {
        previousImagePath = before.imageStoragePath ?? storagePathFromUrl(before.imageUrl);
        transaction.update(ref, {
          imageUrl: admin.firestore.FieldValue.delete(),
          imageStoragePath: admin.firestore.FieldValue.delete(),
          imageAlt: admin.firestore.FieldValue.delete(),
          updatedAt: timestamp,
          updatedBy: caller.uid,
        });
      } else {
        const data = {
          title: input.title,
          body: input.body,
          status: input.status,
          date: input.operation === "create" ? input.date ?? timestamp : before.date ?? timestamp,
          ...(input.category ? { category: input.category } : input.operation === "update" ? { category: admin.firestore.FieldValue.delete() } : {}),
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
          ...(input.imageStoragePath ? { imageStoragePath: input.imageStoragePath } : {}),
          ...(input.imageAlt === null
            ? input.operation === "update" ? { imageAlt: admin.firestore.FieldValue.delete() } : {}
            : input.imageAlt
              ? { imageAlt: input.imageAlt }
              : before?.imageAlt
                ? { imageAlt: before.imageAlt }
                : {}),
          ...(input.imagePositionY !== undefined ? { imagePositionY: input.imagePositionY } : {}),
          ...(input.imageScale !== undefined ? { imageScale: input.imageScale } : {}),
          updatedAt: timestamp,
          updatedBy: caller.uid,
        };
        if (input.operation === "create") transaction.set(ref, data);
        else transaction.update(ref, data);
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: input.operation === "create" ? "home_news_created" : input.operation === "removeImage" ? "home_news_image_removed" : "home_news_updated",
        entity: `homeNews/${input.newsId}`,
        detail: JSON.stringify({ role: caller.role }),
        before,
        after: input.operation === "removeImage" ? { ...before, imageUrl: null, imageStoragePath: null, imageAlt: null } : input,
        timestamp,
      });
    });

    if (input.operation === "removeImage" && previousImagePath) {
      try {
        await admin.storage(app).bucket().file(previousImagePath).delete({ ignoreNotFound: true });
      } catch (err) {
        const queueRef = db.collection("storageCleanupQueue").doc();
        await queueRef.set({
          storagePath: previousImagePath,
          reason: "Eliminazione immagine News non riuscita",
          status: "pending",
          attempts: 1,
          lastError: err instanceof Error ? err.message.slice(0, 500) : "Errore Storage",
          createdAt: timestamp,
          createdBy: caller.uid,
        });
      }
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err, "Errore durante il salvataggio della News");
  }
}

function storagePathFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = "/o/";
    const index = url.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}
