// Migrazione (Fase 7): logoUrl -> teamPhotoUrl. Non copia automaticamente ogni vecchio
// logo come foto di gruppo: per ogni squadra con un logoUrl residuo mostra squadra,
// vecchio URL e l'azione che verrebbe applicata, e scrive solo con --apply esplicito.
//
// Usa Firebase Admin SDK (coerente con lo stile di scripts/migrateStandingsBaseline.mjs):
// non richiede di allentare le regole Firestore.
//
// Uso:
//   node scripts/migrateTeamPhoto.mjs                    (dry-run, default: nessuna scrittura)
//   node scripts/migrateTeamPhoto.mjs --apply=keep        (copia logoUrl in teamPhotoUrl e rimuove logoUrl)
//   node scripts/migrateTeamPhoto.mjs --apply=remove      (rimuove logoUrl senza impostare teamPhotoUrl)
//   node scripts/migrateTeamPhoto.mjs --apply=ignore      (rimuove solo il campo dalla lista da rivedere, non tocca nulla)
//
// Nota: "keep" ha senso solo se il vecchio logoUrl era già, di fatto, una foto della
// squadra intera (non un'icona/logo grafico) — verificare visivamente prima di usarlo.

import admin from "firebase-admin";

const applyArg = process.argv.find((a) => a.startsWith("--apply="));
const APPLY_MODE = applyArg ? applyArg.split("=")[1] : null; // null | "keep" | "remove" | "ignore"

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function migrate() {
  const app = getAdminApp();
  const db = admin.firestore(app);

  const teamsSnap = await db.collection("teams").get();
  const withLegacyLogo = teamsSnap.docs.filter((d) => d.data().logoUrl);

  if (withLegacyLogo.length === 0) {
    console.log("Nessuna squadra con logoUrl residuo. Niente da migrare.");
    process.exit(0);
  }

  console.log(`${withLegacyLogo.length} squadra/e con logoUrl residuo:\n`);
  const batch = db.batch();
  let applied = 0;

  for (const doc of withLegacyLogo) {
    const data = doc.data();
    const proposedAction = APPLY_MODE ?? "(nessuna azione senza --apply)";
    console.log(`- ${data.name} (${doc.id})\n  vecchio logoUrl: ${data.logoUrl}\n  azione: ${proposedAction}`);

    if (APPLY_MODE === "keep") {
      batch.update(doc.ref, { teamPhotoUrl: data.logoUrl, logoUrl: admin.firestore.FieldValue.delete() });
      applied++;
    } else if (APPLY_MODE === "remove") {
      batch.update(doc.ref, { logoUrl: admin.firestore.FieldValue.delete() });
      applied++;
    } else if (APPLY_MODE === "ignore") {
      // Nessuna scrittura: la squadra resta con logoUrl (ormai ignorato dall'interfaccia,
      // che legge solo teamPhotoUrl), da rivedere manualmente in futuro se necessario.
    }
  }

  if (APPLY_MODE === "keep" || APPLY_MODE === "remove") {
    await batch.commit();
    console.log(`\nApplicato a ${applied} squadra/e.`);
  } else {
    console.log(
      `\n[DRY RUN] Nessuna scrittura eseguita. Per applicare: --apply=keep, --apply=remove o --apply=ignore.`
    );
  }
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Errore durante la migrazione:", err);
  process.exit(1);
});
