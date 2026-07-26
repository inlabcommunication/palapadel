import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const teamFields = {
  name: z.string().trim().min(1).max(150),
  roster: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
  teamPhotoUrl: z.string().url().max(2000).optional(),
  teamPhotoStoragePath: z.union([z.string().trim().max(1000), z.null()]).optional(),
  teamPhotoPositionY: z.number().min(0).max(100).optional(),
  teamPhotoScale: z.number().min(1).max(2).optional(),
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), teamId: documentId, ...teamFields }).strict(),
  z.object({ operation: z.literal("update"), teamId: documentId, ...teamFields }).strict(),
  z.object({ operation: z.literal("delete"), teamId: documentId }).strict(),
  z.object({
    operation: z.literal("import"),
    teams: z.array(z.object({
      name: z.string().trim().min(1).max(150),
      roster: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
    }).strict()).min(1).max(200),
  }).strict(),
]);

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    if (input.operation === "import") {
      await db.runTransaction(async (transaction) => {
        const existingSnap = await transaction.get(db.collection("teams"));
        const existingNames = new Set(existingSnap.docs.map((doc) => normalizeTeamName(doc.data().name)));
        const importedNames = new Set();
        for (const team of input.teams) {
          const key = normalizeTeamName(team.name);
          if (existingNames.has(key)) throw new HttpError(409, `La squadra "${team.name}" esiste gia`);
          if (importedNames.has(key)) throw new HttpError(409, `La squadra "${team.name}" e duplicata nel file`);
          importedNames.add(key);
        }

        for (const team of input.teams) {
          const ref = db.collection("teams").doc();
          transaction.set(ref, {
            id: ref.id,
            name: team.name,
            roster: team.roster,
            updatedAt: timestamp,
            updatedBy: caller.uid,
          });
        }
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "teams_imported",
          entity: "teams",
          detail: JSON.stringify({ role: caller.role, count: input.teams.length }),
          before: null,
          after: { count: input.teams.length, names: input.teams.map((team) => team.name) },
          timestamp,
        });
      });
      res.status(200).json({ ok: true, imported: input.teams.length });
      return;
    }

    const ref = db.doc(`teams/${input.teamId}`);
    let deletedPhoto = null;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const before = snapshot.exists ? snapshot.data() : null;
      if (input.operation === "create" && snapshot.exists) throw new HttpError(409, "La squadra esiste già");
      if (input.operation !== "create" && !snapshot.exists) throw new HttpError(404, "Squadra non trovata");

      if (input.operation === "delete") {
        deletedPhoto = before.teamPhotoStoragePath ?? storagePathFromUrl(before.teamPhotoUrl);
        transaction.delete(ref);
      } else {
        const data = {
          name: input.name,
          roster: input.roster,
          ...(input.teamPhotoUrl ? { teamPhotoUrl: input.teamPhotoUrl } : input.operation === "update" && input.teamPhotoStoragePath === null ? { teamPhotoUrl: admin.firestore.FieldValue.delete() } : {}),
          ...(input.teamPhotoStoragePath
            ? { teamPhotoStoragePath: input.teamPhotoStoragePath }
            : input.operation === "update" && input.teamPhotoStoragePath === null
              ? { teamPhotoStoragePath: admin.firestore.FieldValue.delete() }
              : {}),
          ...(input.teamPhotoPositionY !== undefined ? { teamPhotoPositionY: input.teamPhotoPositionY } : {}),
          ...(input.teamPhotoScale !== undefined ? { teamPhotoScale: input.teamPhotoScale } : {}),
          updatedAt: timestamp,
          updatedBy: caller.uid,
        };
        if (input.operation === "create") transaction.set(ref, data);
        else transaction.update(ref, data);
      }
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: input.operation === "create" ? "team_created" : input.operation === "update" ? "team_updated" : "team_deleted",
        entity: `teams/${input.teamId}`,
        detail: JSON.stringify({ role: caller.role }),
        before,
        after: input.operation === "delete" ? null : input,
        timestamp,
      });
    });

    if (deletedPhoto) {
      try {
        await admin.storage(app).bucket().file(deletedPhoto).delete({ ignoreNotFound: true });
      } catch (err) {
        await db.collection("storageCleanupQueue").add({
          storagePath: deletedPhoto,
          reason: "Foto squadra non eliminata",
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
    sendError(res, err, "Errore durante la gestione della squadra");
  }
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
