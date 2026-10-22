import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { HttpError, requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

// Eliminazione DEFINITIVA di un'edizione con tutti i suoi dati (classifica, giornate,
// partite, tabellone, Femminile). L'anagrafica delle squadre non viene toccata: le
// squadre possono partecipare ad altre edizioni. Solo superAdmin, con conferma scritta.
export const EDITION_DATA_COLLECTIONS = [
  "editionTeams",
  "femaleParticipants",
  "matchdays",
  "matches",
  "bracketRounds",
  "bracketMatches",
];

const schema = z.object({
  editionId: documentId,
  confirmation: z.string().trim().min(1).max(200),
  removeHallOfFame: z.boolean().optional(),
}).strict();

export function normalizeConfirmation(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");
}

export function editionLabel(typeName, season) {
  return `${typeName ?? ""} ${season ?? ""}`.trim();
}

const BATCH_SIZE = 400;

export default async function handler(req, res) {
  try {
    requirePost(req);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const { editionId, confirmation, removeHallOfFame } = parseBody(schema, req.body);
    const db = admin.firestore(app);

    const editionRef = db.doc(`championshipEditions/${editionId}`);
    const editionSnap = await editionRef.get();
    if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
    const edition = editionSnap.data();
    const typeSnap = edition.typeId ? await db.doc(`championshipTypes/${edition.typeId}`).get() : null;
    const label = editionLabel(typeSnap?.exists ? typeSnap.data().name : "", edition.season);
    if (normalizeConfirmation(confirmation) !== normalizeConfirmation(label)) {
      throw new HttpError(400, `Conferma non corretta: scrivi esattamente "${label}".`);
    }

    const collections = removeHallOfFame ? [...EDITION_DATA_COLLECTIONS, "historicalWins"] : EDITION_DATA_COLLECTIONS;
    const snapshots = await Promise.all(
      collections.map((name) => db.collection(name).where("editionId", "==", editionId).get())
    );
    const deleted = Object.fromEntries(collections.map((name, index) => [name, snapshots[index].size]));
    const refs = snapshots.flatMap((snap) => snap.docs.map((doc) => doc.ref));

    // Prima i dati collegati, a blocchi; l'edizione per ultima, insieme al log: se
    // qualcosa si interrompe, l'edizione resta visibile e si può ripetere l'operazione.
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref);
      await batch.commit();
    }

    const timestamp = new Date().toISOString();
    const finalBatch = db.batch();
    finalBatch.delete(editionRef);
    finalBatch.set(db.collection("auditLog").doc(), {
      actor: caller.uid,
      action: "championship_purgeEdition",
      entity: `championshipEditions/${editionId}`,
      before: edition,
      after: null,
      detail: JSON.stringify({ role: caller.role, label, deleted, removeHallOfFame: removeHallOfFame === true }),
      timestamp,
    });
    await finalBatch.commit();

    res.status(200).json({ ok: true, deleted });
  } catch (error) {
    sendError(res, error, "Errore durante l'eliminazione definitiva dell'edizione");
  }
}
