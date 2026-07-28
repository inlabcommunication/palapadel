// Funzione serverless (Vercel). Fase 10/11/12 (squadre) + Fase 3 (Femminile) —
// importazione classifica atomica, con tre modalità esplicite, per entrambe le
// categorie di campionato. Riservata ad admin/superAdmin. Se anche una sola riga
// non è risolvibile o non valida, l'intera importazione viene rifiutata: nessuna
// riga viene salvata parzialmente.
//
// Body atteso (comune):
// {
//   editionId: string,
//   mode: 1 | 2 | 3,
//   rows: [...]  // struttura diversa per squadre/Femminile, vedi sotto
// }
//
// SQUADRE (edizione con campionato hasTeams=true):
//   rows: [{ name, points, played, linkedTeamId?, createNewTeam? }]
//   mode2Choice?: "A"|"B", mode2ThresholdMatchdayNumber?: number (solo mode 2)
//   Vedi commenti storici più sotto per la semantica esatta delle 3 modalità.
//
// FEMMINILE (edizione con campionato hasTeams=false):
//   rows: [{ name, points, stages, note?, linkedParticipantId?, createNew? }]
//   mode2AbsentPolicy?: "keep"|"retire"|"remove" (solo mode 2, per le assenti dal file)
//   Non esistono partite da sommare: i punti importati sono l'intero valore mostrato,
//   più eventuali correzioni manuali già presenti (preservate, mai perse).

import admin from "firebase-admin";
import { roleAllowed } from "../_lib/roles.js";
import { computeMatchTotals } from "../_lib/standingsRules.js";
import { documentId, parseBody, z } from "../_lib/validation.js";

const importRow = z.union([
  z.object({
    name: z.string().trim().min(1).max(120), points: z.number().finite(), played: z.number().int().min(0),
    linkedTeamId: documentId.optional(), createNewTeam: z.boolean().optional(),
  }).strict(),
  z.object({
    name: z.string().trim().min(1).max(120), points: z.number().finite(), stages: z.number().int().min(0),
    note: z.string().max(500).optional(), linkedParticipantId: documentId.optional(), createNew: z.boolean().optional(),
  }).strict(),
]);
const importSchema = z.object({
  editionId: documentId,
  mode: z.number().int().min(1).max(3),
  rows: z.array(importRow).min(1).max(500),
  mode2Choice: z.enum(["A", "B"]).optional(),
  mode2ThresholdMatchdayNumber: z.number().int().positive().optional(),
  mode2AbsentPolicy: z.enum(["keep", "retire", "remove"]).optional(),
}).strict();

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function verifyCaller(app, req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) throw new HttpError(401, "Token mancante");
  const decoded = await admin.auth(app).verifyIdToken(idToken);
  const callerSnap = await admin.firestore(app).doc(`users/${decoded.uid}`).get();
  if (!callerSnap.exists) throw new HttpError(403, "Utente non registrato");
  const callerData = callerSnap.data();
  if (callerData.disabled) throw new HttpError(403, "Account disattivato");
  if (!roleAllowed(callerData.role, ["superAdmin"])) {
    throw new HttpError(403, "Solo admin o superAdmin possono importare la classifica");
  }
  return { uid: decoded.uid, role: callerData.role };
}

function normalizeName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`-]/g, " ")
    .replace(/[.,;:!?()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findDuplicateNames(rows) {
  const seen = new Map();
  const duplicates = [];
  rows.forEach((r, index) => {
    const key = normalizeName(r.name);
    if (!key) return;
    if (seen.has(key)) duplicates.push({ index, name: r.name, duplicateOf: seen.get(key) });
    else seen.set(key, r.name);
  });
  return duplicates;
}

export function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export function similarityLevel(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  const editSimilarity = 1 - levenshtein(left, right) / maxLength;
  const containsSimilarity = left.includes(right) || right.includes(left) ? Math.min(left.length, right.length) / maxLength : 0;
  return Math.max(editSimilarity, containsSimilarity);
}

export function findSimilarByName(name, candidates, threshold = 0.82) {
  let best = null;
  for (const candidate of candidates) {
    const similarity = similarityLevel(name, candidate.name);
    if (!best || similarity > best.similarity) best = { candidate, similarity };
  }
  return best && best.similarity >= threshold ? best : null;
}

export function normalizeParticipationStatus(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizeName(String(value));
  const map = {
    normale: "normale",
    attiva: "normale",
    active: "normale",
    ritirata: "ritirata",
    withdrawn: "ritirata",
    squalificata: "squalificata",
    disqualified: "squalificata",
  };
  return map[normalized] ?? null;
}

// =========================== Import SQUADRE (invariato dalle fasi precedenti) ==========

async function handleTeamImport(db, auth, body) {
  const { editionId, mode, mode2Choice, mode2ThresholdMatchdayNumber, rows } = body;
  if (![1, 2, 3].includes(mode)) throw new HttpError(400, "Modalità non valida");
  if (mode === 2 && !["A", "B"].includes(mode2Choice)) {
    throw new HttpError(400, "Per la modalità 2 specificare mode2Choice A o B");
  }
  if (mode === 2 && mode2Choice === "B" && typeof mode2ThresholdMatchdayNumber !== "number") {
    throw new HttpError(400, "Per la modalità 2 scelta B specificare mode2ThresholdMatchdayNumber");
  }

  const duplicates = findDuplicateNames(rows);
  if (duplicates.length > 0) {
    throw new HttpError(
      400,
      "Righe duplicate nel file.",
      duplicates.map((d) => `"${d.name}" sembra la stessa squadra di "${d.duplicateOf}".`)
    );
  }

  const [teamsSnap, editionTeamsSnap, matchdaysSnap] = await Promise.all([
    db.collection("teams").get(),
    db.collection("editionTeams").where("editionId", "==", editionId).get(),
    db.collection("matchdays").where("editionId", "==", editionId).get(),
  ]);
  const teamsById = new Map(teamsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const editionTeamsByTeamId = new Map(editionTeamsSnap.docs.map((d) => [d.data().teamId, { id: d.id, ref: d.ref, ...d.data() }]));
  const matchdayNumberById = new Map(matchdaysSnap.docs.map((d) => [d.id, d.data().number]));

  const matchesSnap = await db.collection("matches").where("editionId", "==", editionId).get();
  const allMatches = matchesSnap.docs.map((d) => d.data());
  const allMatchTotals = computeMatchTotals(allMatches);
  const laterMatchTotals =
    mode === 2 && mode2Choice === "B"
      ? computeMatchTotals(allMatches.filter((m) => (matchdayNumberById.get(m.matchdayId) ?? 0) > mode2ThresholdMatchdayNumber))
      : null;

  const candidates = [...teamsById.values()];
  const resolved = [];
  const unresolved = [];

  rows.forEach((row, index) => {
    if (!row.name || typeof row.points !== "number" || typeof row.played !== "number") {
      unresolved.push({ index, name: row.name ?? "(vuoto)", reason: "Nome, punti e partite giocate sono obbligatori e numerici." });
      return;
    }
    if (row.points < 0 || row.played < 0) {
      unresolved.push({ index, name: row.name, reason: "Punti e partite giocate non possono essere negativi." });
      return;
    }
    if (row.linkedTeamId) {
      if (!teamsById.has(row.linkedTeamId)) {
        unresolved.push({ index, name: row.name, reason: "Squadra collegata non trovata" });
        return;
      }
      resolved.push({ ...row, teamId: row.linkedTeamId, isNewTeam: false });
      return;
    }
    if (row.createNewTeam) {
      resolved.push({ ...row, teamId: null, isNewTeam: true });
      return;
    }
    const exact = candidates.find((t) => t.name === row.name);
    if (exact) {
      resolved.push({ ...row, teamId: exact.id, isNewTeam: false });
      return;
    }
    const normalized = normalizeName(row.name);
    const similar = candidates.find((t) => normalizeName(t.name) === normalized);
    if (similar) {
      unresolved.push({
        index,
        name: row.name,
        reason: `Corrisponde forse a "${similar.name}": conferma collegando (linkedTeamId) o creando una nuova squadra (createNewTeam).`,
        similarTeamId: similar.id,
        similarTeamName: similar.name,
      });
      return;
    }
    unresolved.push({ index, name: row.name, reason: "Nessuna squadra corrispondente: specificare createNewTeam" });
  });

  if (unresolved.length > 0) {
    throw new HttpError(400, "Alcune righe richiedono una scelta esplicita, nessun dato è stato importato.", unresolved);
  }

  const warnings = [];
  const batch = db.batch();
  let matchedCount = 0;
  let createdCount = 0;

  resolved.forEach((row, importedOrder) => {
    let teamId = row.teamId;
    if (row.isNewTeam) {
      const teamRef = db.collection("teams").doc();
      teamId = teamRef.id;
      batch.set(teamRef, { name: row.name, roster: [] });
    }

    const matchTotals = allMatchTotals.get(teamId) ?? { points: 0, played: 0 };
    const laterTotals = laterMatchTotals ? laterMatchTotals.get(teamId) ?? { points: 0, played: 0 } : null;

    if (mode === 1 && matchTotals.played > 0) {
      warnings.push(`${row.name} ha già ${matchTotals.played} partite concluse registrate: verifica che l'importazione non causi un doppio conteggio.`);
    }

    let baselinePoints, baselinePlayed, matchPointsToStore, matchPlayedToStore;
    if (mode === 2 && mode2Choice === "B") {
      baselinePoints = row.points;
      baselinePlayed = row.played;
      matchPointsToStore = laterTotals.points;
      matchPlayedToStore = laterTotals.played;
    } else if (mode === 2 && mode2Choice === "A") {
      baselinePoints = Math.max(0, row.points - matchTotals.points);
      baselinePlayed = Math.max(0, row.played - matchTotals.played);
      matchPointsToStore = matchTotals.points;
      matchPlayedToStore = matchTotals.played;
    } else {
      baselinePoints = row.points;
      baselinePlayed = row.played;
      matchPointsToStore = matchTotals.points;
      matchPlayedToStore = matchTotals.played;
    }

    const existing = editionTeamsByTeamId.get(teamId);
    const manualPoints = existing?.manualPointsAdjustment ?? 0;
    const manualPlayed = existing?.manualPlayedAdjustment ?? 0;
    const docData = {
      editionId,
      teamId,
      baselinePoints,
      baselinePlayed,
      matchPoints: matchPointsToStore,
      matchPlayed: matchPlayedToStore,
      manualPointsAdjustment: manualPoints,
      manualPlayedAdjustment: manualPlayed,
      points: baselinePoints + matchPointsToStore + manualPoints,
      played: baselinePlayed + matchPlayedToStore + manualPlayed,
      order: importedOrder,
      importedOrder,
      status: existing?.status ?? "normale",
    };

    if (existing) {
      batch.update(existing.ref, docData);
      matchedCount++;
    } else {
      const id = `${editionId}_${teamId}`;
      batch.set(db.doc(`editionTeams/${id}`), { id, ...docData });
      createdCount++;
    }
    if (row.isNewTeam) createdCount++;
  });

  const importedAt = new Date().toISOString();
  batch.set(db.collection("auditLog").doc(), {
    actor: auth.uid,
    action: "standings_imported",
    detail: JSON.stringify({ role: auth.role, editionId, mode, mode2Choice: mode2Choice ?? null, category: "squadre", rows: rows.length }),
    before: null,
    after: { matchedCount, createdCount, warnings },
    timestamp: importedAt,
  });

  await batch.commit();
  return { matchedCount, createdCount, warnings };
}

// =========================== Import FEMMINILE (Fase 3) =================================

async function handleFemaleImport(db, auth, body) {
  const { editionId, mode, mode2AbsentPolicy, rows } = body;
  if (![1, 2, 3].includes(mode)) throw new HttpError(400, "Modalità non valida");
  if (mode === 2 && !["keep", "retire", "remove"].includes(mode2AbsentPolicy)) {
    throw new HttpError(400, "Per la modalità 2 specificare mode2AbsentPolicy: keep, retire o remove.");
  }

  if (rows.length === 0) throw new HttpError(400, "Il file non contiene righe valide.");

  // Validazioni: righe vuote, punti non numerici, tappe negative, valori mancanti.
  const rowErrors = [];
  rows.forEach((row, index) => {
    if (!row.name || !row.name.trim()) {
      rowErrors.push(`Riga ${index + 1}: nome mancante.`);
      return;
    }
    if (typeof row.points !== "number" || Number.isNaN(row.points)) {
      rowErrors.push(`Riga ${index + 1} (${row.name}): punti mancanti o non numerici.`);
    }
    if (typeof row.stages !== "number" || Number.isNaN(row.stages) || row.stages < 0) {
      rowErrors.push(`Riga ${index + 1} (${row.name}): tappe mancanti, non numeriche o negative.`);
    }
    if (row.status !== undefined && !normalizeParticipationStatus(row.status)) {
      rowErrors.push(`Riga ${index + 1} (${row.name}): stato "${row.status}" non valido.`);
    }
  });
  if (rowErrors.length > 0) {
    throw new HttpError(400, "Alcune righe non sono valide, nessun dato è stato importato.", rowErrors);
  }

  const duplicates = findDuplicateNames(rows);
  if (duplicates.length > 0) {
    throw new HttpError(
      400,
      "Righe duplicate nel file.",
      duplicates.map((d) => `"${d.name}" sembra la stessa giocatrice di "${d.duplicateOf}".`)
    );
  }

  const existingSnap = await db.collection("femaleParticipants").where("editionId", "==", editionId).get();
  const existingParticipants = existingSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  if (mode === 1 && existingParticipants.length > 0) {
    throw new HttpError(
      400,
      "La Modalità 1 (importazione iniziale) è utilizzabile solo quando la classifica dell'edizione non esiste ancora.",
      [`Sono già presenti ${existingParticipants.length} giocatrici in questa edizione. Usa la Modalità 2 o 3.`]
    );
  }

  // Fase 13 (equivalente Femminile) — nome esatto, simile-ma-non-esatto (richiede
  // scelta esplicita già indicata dal frontend), o nessuna corrispondenza (nuova).
  const resolved = [];
  const unresolved = [];
  rows.forEach((row, index) => {
    if (row.linkedParticipantId) {
      const found = existingParticipants.find((p) => p.id === row.linkedParticipantId);
      if (!found) {
        unresolved.push({ index, name: row.name, reason: "Giocatrice collegata non trovata" });
        return;
      }
      resolved.push({ ...row, participant: found, isNew: false });
      return;
    }
    if (row.createNew) {
      resolved.push({ ...row, participant: null, isNew: true });
      return;
    }
    const exact = existingParticipants.find((p) => p.name === row.name);
    if (exact) {
      resolved.push({ ...row, participant: exact, isNew: false });
      return;
    }
    const normalized = normalizeName(row.name);
    const similar = existingParticipants.find((p) => normalizeName(p.name) === normalized);
    if (similar) {
      unresolved.push({
        index,
        name: row.name,
        reason: `Corrisponde forse a "${similar.name}": conferma collegando (linkedParticipantId) o creando una nuova voce (createNew).`,
        similarParticipantId: similar.id,
        similarParticipantName: similar.name,
        similarity: 1,
        choices: ["use_existing", "create_new"],
      });
      return;
    }
    const fuzzy = findSimilarByName(row.name, existingParticipants);
    if (fuzzy) {
      unresolved.push({
        index,
        name: row.name,
        reason: `Nome molto simile a "${fuzzy.candidate.name}": conferma collegando (linkedParticipantId) o creando una nuova voce (createNew).`,
        similarParticipantId: fuzzy.candidate.id,
        similarParticipantName: fuzzy.candidate.name,
        similarity: Number(fuzzy.similarity.toFixed(2)),
        choices: ["use_existing", "create_new"],
      });
      return;
    }
    resolved.push({ ...row, participant: null, isNew: true });
  });

  if (unresolved.length > 0) {
    throw new HttpError(400, "Alcune righe richiedono una scelta esplicita, nessun dato è stato importato.", unresolved);
  }

  const matchedIds = new Set(resolved.filter((r) => !r.isNew).map((r) => r.participant.id));
  const absentParticipants = existingParticipants.filter((p) => !matchedIds.has(p.id));

  if (mode === 2 && absentParticipants.length > 0 && !mode2AbsentPolicy) {
    throw new HttpError(400, "Specificare una policy per le giocatrici assenti dal file (mode2AbsentPolicy).");
  }

  const batch = db.batch();
  let matchedCount = 0;
  let createdCount = 0;
  let removedCount = 0;
  let retiredCount = 0;

  resolved.forEach((row, importedOrder) => {
    const manualAdjustment = row.participant?.manualPointsAdjustment ?? 0;
    const importedStatus = normalizeParticipationStatus(row.status);
    const docData = {
      editionId,
      name: row.name.trim(),
      calculatedPoints: row.points,
      manualPointsAdjustment: manualAdjustment,
      points: row.points + manualAdjustment,
      stages: row.stages,
      order: importedOrder,
      importedOrder,
      status: importedStatus ?? row.participant?.status ?? "normale",
    };
    if (row.note) docData.note = row.note;

    if (row.participant) {
      batch.update(row.participant.ref, docData);
      matchedCount++;
    } else {
      const ref = db.collection("femaleParticipants").doc();
      batch.set(ref, { id: ref.id, ...docData });
      createdCount++;
    }
  });

  // Fase 3, Modalità 2 — le giocatrici assenti dal file seguono la policy scelta.
  if (mode === 2) {
    absentParticipants.forEach((p, index) => {
      const orderAtBottom = rows.length + index;
      if (mode2AbsentPolicy === "remove") {
        batch.delete(p.ref);
        removedCount++;
      } else if (mode2AbsentPolicy === "retire") {
        batch.update(p.ref, { status: "ritirata", order: orderAtBottom });
        retiredCount++;
      } else if (mode2AbsentPolicy === "keep") {
        batch.update(p.ref, { order: orderAtBottom });
      }
      // "keep": nessuna modifica, resta semplicemente in fondo (order più alto di
      // tutte le righe importate, se non già presente un ordine più alto).
    });
  }

  const importedAt = new Date().toISOString();
  batch.set(db.collection("auditLog").doc(), {
    actor: auth.uid,
    action: "standings_imported",
    detail: JSON.stringify({ role: auth.role, editionId, mode, mode2AbsentPolicy: mode2AbsentPolicy ?? null, category: "femminile", rows: rows.length }),
    before: null,
    after: { matchedCount, createdCount, removedCount, retiredCount },
    timestamp: importedAt,
  });

  await batch.commit();
  return { matchedCount, createdCount, removedCount, retiredCount, warnings: [] };
}

// =========================== Handler =====================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const auth = await verifyCaller(app, req);
    const db = admin.firestore(app);

    const body = parseBody(importSchema, req.body);
    const { editionId, mode, rows } = body;
    if (!editionId || !mode || !Array.isArray(rows) || rows.length === 0) {
      throw new HttpError(400, "Dati mancanti");
    }

    const editionSnap = await db.doc(`championshipEditions/${editionId}`).get();
    if (!editionSnap.exists) throw new HttpError(404, "Edizione non trovata");
    const typeSnap = await db.doc(`championshipTypes/${editionSnap.data().typeId}`).get();
    if (!typeSnap.exists) throw new HttpError(404, "Categoria non trovata.");

    const result = typeSnap.data().hasTeams
      ? await handleTeamImport(db, auth, body)
      : await handleFemaleImport(db, auth, body);

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err?.details?.code === "VALIDATION_ERROR") {
      res.status(err.status ?? 400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message, fields: err.details.fields ?? {} } });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno durante l'importazione" });
  }
}
