import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { canEditOperationalStandings, canEnrollExistingTeam } from "../_lib/roles.js";
import { computeMatchTotalsForTeam } from "../_lib/standingsRules.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const reason = z.string().trim().min(5, "Inserisci una motivazione").max(500);
export const bodySchema = z.union([
  z.object({ op: z.literal("add"), editionId: documentId, teamId: documentId }).strict(),
  z.object({
    op: z.literal("addBulk"),
    editionId: documentId,
    teamIds: z.array(documentId).min(1).max(100),
  }).strict(),
  z.object({
    op: z.literal("reorderTie"),
    editionId: documentId,
    orderedIds: z.array(documentId).min(2).max(100),
  }).strict(),
  z.object({
    op: z.literal("add"),
    editionId: documentId,
    newTeam: z.object({
      name: z.string().trim().min(2).max(120),
      roster: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    }).strict(),
  }).strict(),
  z.object({
    op: z.literal("update"),
    editionId: documentId,
    editionTeamId: documentId,
    baselinePoints: z.number().finite(),
    baselinePlayed: z.number().int().min(0),
    manualPointsAdjustment: z.number().finite(),
    manualPlayedAdjustment: z.number().int(),
    order: z.number().int().min(0),
    operationalNotes: z.string().trim().max(1000).optional(),
    reason,
  }).strict(),
  z.object({ op: z.literal("remove"), editionId: documentId, editionTeamId: documentId, reason }).strict(),
]);

async function assertEditionHasTeams(db, editionId) {
  const editionSnap = await db.doc(`championshipEditions/${editionId}`).get();
  if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
  const typeSnap = await db.doc(`championshipTypes/${editionSnap.data().typeId}`).get();
  if (!typeSnap.exists || !typeSnap.data().hasTeams) {
    throw new HttpError(400, "Il campionato non e a squadre");
  }
  return editionSnap.data();
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req);
    if (!canEditOperationalStandings(caller.role)) {
      throw new HttpError(403, "Non hai il permesso di modificare la classifica");
    }
    const input = parseBody(bodySchema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    const edition = await assertEditionHasTeams(db, input.editionId);

    if (input.op === "reorderTie") {
      await db.runTransaction(async (transaction) => {
        const uniqueIds = [...new Set(input.orderedIds)];
        if (uniqueIds.length !== input.orderedIds.length) {
          throw new HttpError(400, "La selezione contiene duplicati");
        }
        const refs = uniqueIds.map((id) => db.doc(`editionTeams/${id}`));
        const snaps = await transaction.getAll(...refs);
        if (snaps.some((snap) => !snap.exists)) throw new HttpError(404, "Voce di classifica non trovata");
        const entries = snaps.map((snap) => snap.data());
        if (entries.some((entry) => entry.editionId !== input.editionId)) {
          throw new HttpError(400, "Edizione non coerente");
        }
        if (new Set(entries.map((entry) => entry.points)).size !== 1) {
          throw new HttpError(400, "Si possono riordinare solo squadre a pari punti");
        }
        refs.forEach((ref, index) => transaction.update(ref, { order: index }));
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "standings_tie_reordered",
          entity: `championshipEditions/${input.editionId}`,
          before: entries.map((entry, index) => ({ id: uniqueIds[index], order: entry.order })),
          after: uniqueIds.map((id, order) => ({ id, order })),
          detail: JSON.stringify({ role: caller.role }),
          timestamp,
        });
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (input.op === "add" || input.op === "addBulk") {
      if (!canEnrollExistingTeam(caller.role)) {
        throw new HttpError(403, "Solo Admin e Super Admin possono iscrivere una squadra");
      }
      if (input.op === "add" && "newTeam" in input && caller.role !== "superAdmin") {
        throw new HttpError(403, "Solo il Super Admin puo creare una nuova squadra");
      }

      await db.runTransaction(async (transaction) => {
        if (input.op === "addBulk") {
          const teamIds = [...new Set(input.teamIds)];
          if (teamIds.length !== input.teamIds.length) {
            throw new HttpError(400, "La selezione contiene squadre duplicate");
          }
          const teamRefs = teamIds.map((teamId) => db.doc(`teams/${teamId}`));
          const teamSnaps = await transaction.getAll(...teamRefs);
          const entriesSnap = await transaction.get(
            db.collection("editionTeams").where("editionId", "==", input.editionId)
          );
          const enrolledIds = new Set(entriesSnap.docs.map((doc) => doc.data().teamId));

          teamSnaps.forEach((teamSnap, index) => {
            const teamId = teamIds[index];
            if (!teamSnap.exists || teamSnap.data().deletedAt) {
              throw new HttpError(404, "Una delle squadre selezionate non e disponibile");
            }
            const compatible = teamSnap.data().compatibleTypeIds;
            if (Array.isArray(compatible) && !compatible.includes(edition.typeId)) {
              throw new HttpError(400, `La squadra ${teamSnap.data().name || teamId} non e compatibile con questa categoria`);
            }
            if (enrolledIds.has(teamId)) {
              throw new HttpError(409, `La squadra ${teamSnap.data().name || teamId} e gia iscritta`);
            }
          });

          teamIds.forEach((teamId, index) => {
            const entryRef = db.doc(`editionTeams/${input.editionId}_${teamId}`);
            transaction.set(entryRef, {
              id: entryRef.id,
              editionId: input.editionId,
              teamId,
              baselinePoints: 0,
              baselinePlayed: 0,
              matchPoints: 0,
              matchPlayed: 0,
              manualPointsAdjustment: 0,
              manualPlayedAdjustment: 0,
              points: 0,
              played: 0,
              order: entriesSnap.size + index,
              status: "normale",
            });
          });
          transaction.set(db.collection("auditLog").doc(), {
            actor: caller.uid,
            action: "editionteams_added_bulk",
            entity: `championshipEditions/${input.editionId}`,
            before: null,
            after: { editionId: input.editionId, teamIds },
            detail: JSON.stringify({ role: caller.role, count: teamIds.length }),
            timestamp,
          });
          return;
        }

        let teamId = "teamId" in input ? input.teamId : null;
        let newTeamWrite = null;
        if ("newTeam" in input) {
          const teamRef = db.collection("teams").doc();
          teamId = teamRef.id;
          newTeamWrite = {
            ref: teamRef,
            data: {
              id: teamId,
              name: input.newTeam.name,
              roster: input.newTeam.roster,
              createdAt: timestamp,
            },
          };
        } else {
          const teamSnap = await transaction.get(db.doc(`teams/${teamId}`));
          if (!teamSnap.exists || teamSnap.data().deletedAt) throw new HttpError(404, "Squadra non disponibile");
          const compatible = teamSnap.data().compatibleTypeIds;
          if (Array.isArray(compatible) && !compatible.includes(edition.typeId)) {
            throw new HttpError(400, "La squadra non e compatibile con questa categoria");
          }
        }

        const entryRef = db.doc(`editionTeams/${input.editionId}_${teamId}`);
        if ((await transaction.get(entryRef)).exists) throw new HttpError(409, "Squadra gia iscritta");
        const entriesSnap = await transaction.get(
          db.collection("editionTeams").where("editionId", "==", input.editionId)
        );
        if (newTeamWrite) transaction.set(newTeamWrite.ref, newTeamWrite.data);
        transaction.set(entryRef, {
          id: entryRef.id,
          editionId: input.editionId,
          teamId,
          baselinePoints: 0,
          baselinePlayed: 0,
          matchPoints: 0,
          matchPlayed: 0,
          manualPointsAdjustment: 0,
          manualPlayedAdjustment: 0,
          points: 0,
          played: 0,
          order: entriesSnap.size,
          status: "normale",
        });
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "editionteam_added",
          entity: `editionTeams/${entryRef.id}`,
          before: null,
          after: { editionId: input.editionId, teamId },
          detail: JSON.stringify({ role: caller.role }),
          timestamp,
        });
      });
      res.status(200).json({
        ok: true,
        ...(input.op === "addBulk" ? { added: input.teamIds.length } : {}),
      });
      return;
    }

    if (input.op === "update") {
      await db.runTransaction(async (transaction) => {
        const entryRef = db.doc(`editionTeams/${input.editionTeamId}`);
        const entrySnap = await transaction.get(entryRef);
        if (!entrySnap.exists) throw new HttpError(404, "Voce di classifica non trovata");
        const before = entrySnap.data();
        if (before.editionId !== input.editionId) throw new HttpError(400, "Edizione non coerente");
        const matchesSnap = await transaction.get(
          db.collection("matches").where("editionId", "==", input.editionId)
        );
        const totals = computeMatchTotalsForTeam(matchesSnap.docs.map((doc) => doc.data()), before.teamId);
        const operationalNotes = input.operationalNotes || null;
        const entryUpdate = {
          baselinePoints: input.baselinePoints,
          baselinePlayed: input.baselinePlayed,
          matchPoints: totals.points,
          matchPlayed: totals.played,
          manualPointsAdjustment: input.manualPointsAdjustment,
          manualPlayedAdjustment: input.manualPlayedAdjustment,
          points: input.baselinePoints + totals.points + input.manualPointsAdjustment,
          played: input.baselinePlayed + totals.played + input.manualPlayedAdjustment,
          order: input.order,
          operationalNotes: operationalNotes ?? admin.firestore.FieldValue.delete(),
        };
        transaction.update(entryRef, entryUpdate);
        transaction.set(db.collection("auditLog").doc(), {
          actor: caller.uid,
          action: "editionteam_updated",
          entity: `editionTeams/${entryRef.id}`,
          before,
          after: {
            ...before,
            ...entryUpdate,
            operationalNotes,
          },
          detail: JSON.stringify({ role: caller.role, reason: input.reason }),
          timestamp,
        });
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (caller.role !== "superAdmin") throw new HttpError(403, "Operazione riservata al Super Admin");
    await db.runTransaction(async (transaction) => {
      const entryRef = db.doc(`editionTeams/${input.editionTeamId}`);
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists) throw new HttpError(404, "Voce di classifica non trovata");
      const before = entrySnap.data();
      if (before.editionId !== input.editionId) throw new HttpError(400, "Edizione non coerente");
      transaction.delete(entryRef);
      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "editionteam_removed",
        entity: `editionTeams/${entryRef.id}`,
        before,
        after: null,
        detail: JSON.stringify({ role: caller.role, reason: input.reason }),
        timestamp,
      });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, "Errore interno nella gestione della classifica");
  }
}
