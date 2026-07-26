import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { parseBody, z } from "../_lib/validation.js";

const BACKUP_COLLECTIONS = Object.freeze({
  championshipTypes: "campionati",
  championshipEditions: "edizioni",
  teams: "squadre",
  editionTeams: "iscrizioni",
  femaleParticipants: "partecipantiFemminile",
  matchdays: "giornate",
  matches: "partite",
  bracketRounds: "turniTabellone",
  bracketMatches: "partiteTabellone",
  historicalWins: "alboDOro",
  homeNews: "news",
  notificationSettings: "configurazioneNotifiche",
  publicSettings: "impostazioniPubbliche",
  auditLog: "audit",
  tournaments: "tornei",
  tournamentGroups: "gironiTornei",
  tournamentGroupTeams: "squadreGironiTornei",
  tournamentBracketRounds: "turniTabelloniTornei",
  tournamentBracketMatches: "partiteTabelloniTornei",
});

function jsonSafe(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    parseBody(z.object({}).strict(), req.body);
    const app = getAdminApp();
    const caller = await verifyCaller(app, req, ["superAdmin"]);
    const db = admin.firestore(app);

    const entries = await Promise.all(
      Object.entries(BACKUP_COLLECTIONS).map(async ([collectionName, exportName]) => {
        const snap = await db.collection(collectionName).get();
        return [exportName, snap.docs.map((doc) => ({ id: doc.id, ...jsonSafe(doc.data()) }))];
      })
    );

    await db.collection("auditLog").add({
      actor: caller.uid,
      action: "backup_downloaded",
      detail: JSON.stringify({ role: caller.role, schemaVersion: 2 }),
      before: null,
      after: { collections: entries.length },
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      ok: true,
      backup: {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        ...Object.fromEntries(entries),
      },
    });
  } catch (err) {
    sendError(res, err, "Errore durante la creazione del backup");
  }
}
