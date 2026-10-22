import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { IMPORT_ACTIONS, resolveTeamImport } from "../../shared/teamImportPlan.js";

// Import squadre da Excel con scelta esplicita per i nomi già esistenti (usa, sostituisci
// i giocatori, crea una copia, salta). Con editionId le squadre vengono anche iscritte
// a quell'edizione. Tutto in un'unica transazione: o va a buon fine tutto o niente.
const playerName = z.string().trim().min(1).max(150);
const schema = z.object({
  editionId: documentId.optional(),
  rows: z.array(z.object({
    name: z.string().trim().min(1).max(150),
    roster: z.array(playerName).min(2).max(6),
    action: z.enum(IMPORT_ACTIONS),
    existingTeamId: documentId.optional(),
    copyName: z.string().trim().max(150).optional(),
  }).strict()).min(1).max(100),
}).strict();

function emptyEntry(editionId, teamId, order) {
  return {
    id: `${editionId}_${teamId}`,
    editionId,
    teamId,
    baselinePoints: 0,
    baselinePlayed: 0,
    matchPoints: 0,
    matchPlayed: 0,
    manualPointsAdjustment: 0,
    manualPlayedAdjustment: 0,
    points: 0,
    played: 0,
    order,
    status: "normale",
  };
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { editionId, rows } = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    const summary = { created: 0, replaced: 0, used: 0, enrolled: 0, skipped: 0 };

    await db.runTransaction(async (transaction) => {
      let edition = null;
      let entriesSnap = null;
      if (editionId) {
        const editionSnap = await transaction.get(db.doc(`championshipEditions/${editionId}`));
        if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
        edition = editionSnap.data();
        const typeSnap = await transaction.get(db.doc(`championshipTypes/${edition.typeId}`));
        if (!typeSnap.exists || !typeSnap.data().hasTeams) throw new HttpError(400, "Il campionato non e a squadre");
        entriesSnap = await transaction.get(db.collection("editionTeams").where("editionId", "==", editionId));
      }
      const teamsSnap = await transaction.get(db.collection("teams"));
      const existingTeams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const enrolledTeamIds = entriesSnap ? entriesSnap.docs.map((doc) => doc.data().teamId) : [];

      const { errors, operations } = resolveTeamImport(rows, existingTeams, {
        enrolledTeamIds,
        typeId: edition?.typeId ?? null,
      });
      if (errors.length > 0) throw new HttpError(409, errors.join(" "));
      summary.skipped = rows.filter((row) => row.action === "skip").length;

      let order = entriesSnap ? entriesSnap.size : 0;
      const enrolledNow = [];
      for (const op of operations) {
        let teamId = op.teamId;
        if (op.type === "create") {
          const ref = db.collection("teams").doc();
          teamId = ref.id;
          transaction.set(ref, {
            id: teamId,
            name: op.name,
            roster: op.roster,
            createdAt: timestamp,
            updatedAt: timestamp,
            updatedBy: caller.uid,
          });
          summary.created += 1;
        } else if (op.type === "replace") {
          transaction.update(db.doc(`teams/${teamId}`), { roster: op.roster, updatedAt: timestamp, updatedBy: caller.uid });
          summary.replaced += 1;
        } else {
          summary.used += 1;
        }
        if (editionId && op.enroll) {
          transaction.set(db.doc(`editionTeams/${editionId}_${teamId}`), emptyEntry(editionId, teamId, order));
          order += 1;
          summary.enrolled += 1;
          enrolledNow.push(teamId);
        }
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: editionId ? "teams_imported_to_edition" : "teams_imported",
        entity: editionId ? `championshipEditions/${editionId}` : "teams",
        before: operations.filter((op) => op.type === "replace").map((op) => ({ teamId: op.teamId, roster: op.previousRoster })),
        after: { operations: operations.map(({ previousRoster, ...op }) => op), enrolled: enrolledNow },
        detail: JSON.stringify({ role: caller.role, ...summary }),
        timestamp,
      });
    });

    res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    sendError(res, error, "Errore durante l'importazione delle squadre");
  }
}
