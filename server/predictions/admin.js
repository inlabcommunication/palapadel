import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { rebuildPredictionLeaderboards } from "../_lib/predictionScoring.js";
import { sortLeaderboard } from "../../shared/predictions.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const periodFields = {
  name: z.string().trim().min(2).max(60),
  startDate: date,
  endDate: date,
  editionIds: z.array(documentId).min(1, "Scegli almeno un campionato").max(20),
};
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("createPeriod"), ...periodFields }).strict(),
  z.object({ operation: z.literal("updatePeriod"), periodId: documentId, ...periodFields }).strict(),
  z.object({ operation: z.literal("deletePeriod"), periodId: documentId }).strict(),
  z.object({ operation: z.literal("closePeriod"), periodId: documentId }).strict(),
  z.object({ operation: z.literal("reopenPeriod"), periodId: documentId }).strict(),
  z.object({ operation: z.literal("rebuild") }).strict(),
]);

function assertNoOverlap(periods, candidate) {
  if (candidate.startDate > candidate.endDate) throw new HttpError(400, "La data di fine deve essere uguale o successiva a quella di inizio");
  const clash = periods.find(
    (period) =>
      period.id !== candidate.id &&
      period.startDate <= candidate.endDate &&
      candidate.startDate <= period.endDate &&
      (period.editionIds ?? []).some((id) => candidate.editionIds.includes(id))
  );
  if (clash) throw new HttpError(409, `Le date si sovrappongono a "${clash.name}" per almeno un campionato`);
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();
    let result = {};

    if (input.operation === "rebuild") {
      result = await rebuildPredictionLeaderboards(db);
    } else if (input.operation === "createPeriod" || input.operation === "updatePeriod") {
      const periodsSnap = await db.collection("predictionPeriods").get();
      const periods = periodsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const ref = input.operation === "createPeriod" ? db.collection("predictionPeriods").doc() : db.doc(`predictionPeriods/${input.periodId}`);
      if (input.operation === "updatePeriod" && !periods.some((period) => period.id === ref.id)) throw new HttpError(404, "Periodo non trovato");
      const data = { name: input.name, startDate: input.startDate, endDate: input.endDate, editionIds: [...new Set(input.editionIds)] };
      assertNoOverlap(periods, { id: ref.id, ...data });
      await ref.set({ ...data, updatedAt: timestamp, ...(input.operation === "createPeriod" ? { createdAt: timestamp } : {}) }, { merge: true });
      // Le date o i campionati cambiati possono spostare punti tra i periodi.
      if (input.operation === "updatePeriod") await rebuildPredictionLeaderboards(db);
      result = { periodId: ref.id };
    } else if (input.operation === "deletePeriod") {
      await db.doc(`predictionPeriods/${input.periodId}`).delete();
      await rebuildPredictionLeaderboards(db);
    } else if (input.operation === "closePeriod") {
      const [periodSnap, boardSnap] = await Promise.all([
        db.doc(`predictionPeriods/${input.periodId}`).get(),
        db.doc(`predictionLeaderboards/${input.periodId}`).get(),
      ]);
      if (!periodSnap.exists) throw new HttpError(404, "Periodo non trovato");
      const entries = Object.values(boardSnap.exists ? boardSnap.data().entries ?? {} : {}).filter((entry) => entry.played > 0);
      const winners = sortLeaderboard(entries).slice(0, 3).map((entry, index) => ({
        position: index + 1,
        nickname: entry.nickname,
        points: entry.points ?? 0,
        exact: entry.exact ?? 0,
      }));
      await periodSnap.ref.update({ closedAt: timestamp, winners });
      result = { winners };
    } else if (input.operation === "reopenPeriod") {
      await db.doc(`predictionPeriods/${input.periodId}`).update({ closedAt: admin.firestore.FieldValue.delete(), winners: admin.firestore.FieldValue.delete() });
    }

    await db.collection("auditLog").add({
      actor: caller.uid,
      action: `predictions_${input.operation}`,
      entity: "predictionPeriods",
      before: null,
      after: { ...input, ...result },
      detail: JSON.stringify({ role: caller.role }),
      timestamp,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err, "Errore nella gestione dei pronostici");
  }
}
