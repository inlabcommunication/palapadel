// Migrazione (Fase 15/17): popola baselinePoints/baselinePlayed/matchPoints/matchPlayed
// su tutti i documenti editionTeams che non li hanno ancora (creati da versioni
// precedenti dell'app). Usa Firebase Admin SDK: NON richiede di allentare le regole
// Firestore (l'Admin SDK le bypassa sempre), a differenza della versione precedente
// basata sull'SDK client.
//
// Idempotente: ogni documento migrato riceve dataModelVersion=2 e migratedAt. Una
// seconda esecuzione salta i documenti già alla versione 2 (non li tocca di nuovo),
// quindi è sicuro rieseguire lo script più volte.
//
// Regole di compatibilità (non cancella mai dati):
//   - se esiste points ma non baselinePoints, il totale finale (points/played) mostrato
//     oggi NON cambia: viene solo scomposto in baseline + partite + correzione manuale;
//   - status, order e manualPointsAdjustment restano invariati.
//
// Configurazione richiesta:
//   - variabile d'ambiente FIREBASE_SERVICE_ACCOUNT con il JSON della chiave di servizio
//     (la stessa usata dagli endpoint in api/), oppure GOOGLE_APPLICATION_CREDENTIALS
//     puntata a un file locale con le stesse credenziali.
//
// Uso:
//   npm run migrate:standings:dry     (default: sola anteprima, nessuna scrittura)
//   npm run migrate:standings:apply   (applica davvero la migrazione)

import admin from "firebase-admin";

const DATA_MODEL_VERSION = 2;
const APPLY = process.argv.includes("--apply");

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  // Ricade su GOOGLE_APPLICATION_CREDENTIALS / credenziali di ambiente (gcloud, Cloud Run, ecc.)
  return admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const STANDING_POINTS = {
  "2-0": { team1: 3, team2: 0 },
  "2-1": { team1: 2, team2: 1 },
  "1-2": { team1: 1, team2: 2 },
  "0-2": { team1: 0, team2: 3 },
};

async function migrate() {
  const app = getAdminApp();
  const db = admin.firestore(app);

  const editionTeamsSnap = await db.collection("editionTeams").get();
  const allEditionTeams = editionTeamsSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const byEdition = new Map();
  for (const et of allEditionTeams) {
    if (!byEdition.has(et.editionId)) byEdition.set(et.editionId, []);
    byEdition.get(et.editionId).push(et);
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (const [editionId, editionTeams] of byEdition) {
    const matchesSnap = await db
      .collection("matches")
      .where("editionId", "==", editionId)
      .where("status", "==", "conclusa")
      .get();

    const totals = new Map();
    for (const doc_ of matchesSnap.docs) {
      const m = doc_.data();
      const pts = STANDING_POINTS[m.result];
      if (!pts) continue;
      const t1 = totals.get(m.team1Id) ?? { points: 0, played: 0 };
      t1.points += pts.team1;
      t1.played += 1;
      totals.set(m.team1Id, t1);
      const t2 = totals.get(m.team2Id) ?? { points: 0, played: 0 };
      t2.points += pts.team2;
      t2.played += 1;
      totals.set(m.team2Id, t2);
    }

    const batch = db.batch();
    let batchHasWrites = false;

    for (const et of editionTeams) {
      // Idempotenza: un documento già alla versione corrente non viene ritoccato.
      if (et.dataModelVersion === DATA_MODEL_VERSION) {
        skippedCount++;
        continue;
      }

      const matchTotals = totals.get(et.teamId) ?? { points: 0, played: 0 };
      const manualPoints = et.manualPointsAdjustment ?? 0;
      const manualPlayed = et.manualPlayedAdjustment ?? 0;
      const baselinePoints =
        et.baselinePoints !== undefined ? et.baselinePoints : Math.max(0, (et.points ?? 0) - matchTotals.points - manualPoints);
      const baselinePlayed =
        et.baselinePlayed !== undefined ? et.baselinePlayed : Math.max(0, (et.played ?? 0) - matchTotals.played - manualPlayed);

      console.log(
        `${APPLY ? "" : "[DRY RUN] "}${editionId} / ${et.teamId}: baselinePoints=${baselinePoints}, ` +
          `baselinePlayed=${baselinePlayed}, matchPoints=${matchTotals.points}, matchPlayed=${matchTotals.played} ` +
          `(finale invariato: ${et.points ?? 0} pt, ${et.played ?? 0} PG; status=${et.status}, order=${et.order})`
      );

      if (APPLY) {
        batch.update(et.ref, {
          baselinePoints,
          baselinePlayed,
          matchPoints: matchTotals.points,
          matchPlayed: matchTotals.played,
          dataModelVersion: DATA_MODEL_VERSION,
          migratedAt: new Date().toISOString(),
        });
        batchHasWrites = true;
      }
      migratedCount++;
    }

    if (batchHasWrites) await batch.commit();
  }

  console.log(
    `\n${APPLY ? "Migrazione applicata" : "[DRY RUN] Nessuna scrittura eseguita"}: ` +
      `${migratedCount} squadre da migrare, ${skippedCount} già alla versione ${DATA_MODEL_VERSION}.`
  );
  if (!APPLY) {
    console.log("Per applicare davvero: npm run migrate:standings:apply");
  }
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Errore durante la migrazione:", err);
  process.exit(1);
});
