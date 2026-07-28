import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const role = z.enum(["admin", "resultManager"]);
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._ -]+$/),
    password: z.string().min(6).max(128),
    role,
  }).strict(),
  z.object({ operation: z.literal("update"), uid: documentId, role, disabled: z.boolean() }).strict(),
]);

const slugify = (value) =>
  value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default async function handler(req, res) {
  let createdUid = null;
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    if (input.operation === "create") {
      const slug = slugify(input.username);
      if (!slug) throw new HttpError(400, "Nome utente non valido");
      const email = `${slug}@palapadel.local`;
      if ((await db.doc(`usernameEmails/${slug}`).get()).exists) throw new HttpError(409, "Nome utente gia in uso");
      const user = await admin.auth(app).createUser({ email, password: input.password, displayName: input.username });
      createdUid = user.uid;
      await db.runTransaction(async (transaction) => {
        const mappingRef = db.doc(`usernameEmails/${slug}`);
        if ((await transaction.get(mappingRef)).exists) throw new HttpError(409, "Nome utente gia in uso");
        const userData = {
          uid: user.uid,
          username: input.username,
          role: input.role,
          disabled: false,
          createdAt: timestamp,
        };
        transaction.set(db.doc(`users/${user.uid}`), userData);
        transaction.set(mappingRef, { email });
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "user_created",
          entity: `users/${user.uid}`,
          before: null,
          after: userData,
          detail: JSON.stringify({ role: caller.role }),
          timestamp,
        });
      });
      res.status(200).json({ ok: true, uid: user.uid });
      return;
    }

    const targetRef = db.doc(`users/${input.uid}`);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) throw new HttpError(404, "Utente non trovato");
    const before = targetSnap.data();
    if (before.role === "superAdmin") throw new HttpError(403, "Il Super Admin non puo essere modificato qui");

    const authUser = await admin.auth(app).getUser(input.uid);
    await admin.auth(app).updateUser(input.uid, { disabled: input.disabled });
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(targetRef);
        if (!snap.exists) throw new HttpError(404, "Utente non trovato");
        if (snap.data().role === "superAdmin") throw new HttpError(403, "Il Super Admin non puo essere modificato qui");
        const current = snap.data();
        const after = { ...current, role: input.role, disabled: input.disabled, updatedAt: timestamp };
        transaction.update(targetRef, { role: input.role, disabled: input.disabled, updatedAt: timestamp });
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "user_updated",
          entity: `users/${input.uid}`,
          before: current,
          after,
          detail: JSON.stringify({ role: caller.role }),
          timestamp,
        });
      });
    } catch (error) {
      await admin.auth(app).updateUser(input.uid, { disabled: authUser.disabled }).catch(() => undefined);
      throw error;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    if (createdUid) {
      await admin.auth(getAdminApp()).deleteUser(createdUid).catch(() => undefined);
    }
    sendError(res, error, "Errore nella gestione dell'utente");
  }
}
