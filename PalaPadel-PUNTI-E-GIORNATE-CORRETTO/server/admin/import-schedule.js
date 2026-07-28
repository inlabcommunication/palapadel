import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, optionalDate, optionalTime, parseBody, z } from "../_lib/validation.js";

const rowSchema = z.object({
  matchdayNumber: z.number().int().positive().max(999),
  team1Id: documentId,
  team2Id: documentId,
  matchDate: optionalDate,
  matchTime: optionalTime,
  court: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const schema = z.object({
  editionId: documentId,
  mode: z.enum(["add", "replace"]),
  rows: z.array(rowSchema).min(1).max(200),
}).strict();

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const input = parseBody(schema, req.body);
    const db = admin.firestore(app);
    const timestamp = new Date().toISOString();

    for (const row of input.rows) {
      if (row.team1Id === row.team2Id) throw new HttpError(400, "Una squadra non può giocare contro sé stessa");
    }
    const inputKeys = input.rows.map((row) =>
      `${row.matchdayNumber}:${[row.team1Id, row.team2Id].sort().join(":")}`
    );
    if (new Set(inputKeys).size !== inputKeys.length) throw new HttpError(409, "Il calendario contiene partite duplicate");

    let imported = 0;
    await db.runTransaction(async (transaction) => {
      const editionRef = db.doc(`championshipEditions/${input.editionId}`);
      const [editionSnap, entriesSnap, matchdaysSnap, matchesSnap] = await Promise.all([
        transaction.get(editionRef),
        transaction.get(db.collection("editionTeams").where("editionId", "==", input.editionId)),
        transaction.get(db.collection("matchdays").where("editionId", "==", input.editionId)),
        transaction.get(db.collection("matches").where("editionId", "==", input.editionId)),
      ]);
      if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
      if (editionSnap.data().status !== "attiva") throw new HttpError(400, "Il calendario può essere importato solo in un'edizione attiva");

      const enrolled = new Set(entriesSnap.docs.map((doc) => doc.data().teamId));
      const distinctImportedDays = new Set(input.rows.map((row) => row.matchdayNumber)).size;
      const estimatedWrites =
        (input.mode === "replace" ? matchdaysSnap.size + matchesSnap.size : 0) +
        input.rows.length +
        distinctImportedDays +
        1;
      if (estimatedWrites > 450) {
        throw new HttpError(400, "Il calendario supera il limite atomico di 450 operazioni: dividilo in più importazioni.");
      }
      for (const row of input.rows) {
        if (!enrolled.has(row.team1Id) || !enrolled.has(row.team2Id)) {
          throw new HttpError(400, "Il calendario contiene una squadra non iscritta");
        }
      }

      const dayByNumber = new Map(matchdaysSnap.docs.map((doc) => [doc.data().number, doc.ref]));
      const existingKeys = new Set(matchesSnap.docs.map((doc) => {
        const match = doc.data();
        const day = matchdaysSnap.docs.find((candidate) => candidate.id === match.matchdayId)?.data().number;
        return `${day}:${[match.team1Id, match.team2Id].sort().join(":")}`;
      }));

      if (input.mode === "replace") {
        matchesSnap.docs.forEach((doc) => transaction.delete(doc.ref));
        matchdaysSnap.docs.forEach((doc) => transaction.delete(doc.ref));
        dayByNumber.clear();
        existingKeys.clear();
      }

      for (const row of input.rows) {
        const key = `${row.matchdayNumber}:${[row.team1Id, row.team2Id].sort().join(":")}`;
        if (existingKeys.has(key)) continue;
        let dayRef = dayByNumber.get(row.matchdayNumber);
        if (!dayRef) {
          dayRef = db.collection("matchdays").doc();
          dayByNumber.set(row.matchdayNumber, dayRef);
          transaction.set(dayRef, {
            id: dayRef.id,
            editionId: input.editionId,
            number: row.matchdayNumber,
            createdAt: timestamp,
          });
        }
        const matchRef = db.collection("matches").doc();
        transaction.set(matchRef, {
          id: matchRef.id,
          editionId: input.editionId,
          matchdayId: dayRef.id,
          team1Id: row.team1Id,
          team2Id: row.team2Id,
          status: "da_giocare",
          ...(row.matchDate ? { matchDate: row.matchDate } : {}),
          ...(row.matchTime ? { matchTime: row.matchTime } : {}),
          ...(row.court ? { court: row.court } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
          updatedAt: timestamp,
          updatedBy: caller.uid,
        });
        existingKeys.add(key);
        imported += 1;
      }

      transaction.set(db.collection("auditLog").doc(), {
        actor: caller.uid,
        action: "schedule_imported",
        entity: `championshipEditions/${input.editionId}`,
        detail: JSON.stringify({ role: caller.role, mode: input.mode }),
        before: { matchdays: matchdaysSnap.size, matches: matchesSnap.size },
        after: { imported, mode: input.mode },
        timestamp,
      });
    });

    res.status(200).json({ ok: true, imported });
  } catch (err) {
    sendError(res, err, "Errore durante l'importazione del calendario");
  }
}
