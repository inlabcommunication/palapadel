// Popola Firestore con dati demo (sezione 27 della specifica).
// Uso:
//   1. npm install
//   2. Crea .env.local con le chiavi Firebase (vedi .env.example)
//   3. node scripts/seed.mjs
//
// Nota: usa l'SDK client (non serve una service account), quindi le
// regole Firestore devono permettere la scrittura di questi dati.
// Se hai già pubblicato le regole definitive, esegui questo script
// autenticandoti prima come superadmin, oppure allenta temporaneamente
// le regole, semina, e ripristina le regole.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

function loadEnv() {
  try {
    const content = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    const env = {};
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
  } catch {
    console.error("Manca .env.local. Copia .env.example e riempilo prima di eseguire il seed.");
    process.exit(1);
  }
}

const env = loadEnv();

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

async function seed() {
  const types = [
    { id: "serie-b", name: "Serie B", hasTeams: true, badgeColor: "serie-b" },
    { id: "serie-c", name: "Serie C", hasTeams: true, badgeColor: "serie-c" },
    { id: "principianti", name: "Principianti", hasTeams: true, badgeColor: "principianti" },
    { id: "femminile", name: "Femminile", hasTeams: false, badgeColor: "femminile" },
  ];
  for (const t of types) await setDoc(doc(collection(db, "championshipTypes"), t.id), t);

  const editions = [
    { id: "e-serieb-2526", typeId: "serie-b", season: "2025/2026", status: "attiva" },
    { id: "e-seriec-2526", typeId: "serie-c", season: "2025/2026", status: "attiva" },
    { id: "e-princ-2425", typeId: "principianti", season: "2024/2025", status: "conclusa" },
    { id: "e-femm-2026", typeId: "femminile", season: "2026", status: "attiva" },
  ];
  for (const e of editions) await setDoc(doc(collection(db, "championshipEditions"), e.id), e);

  const teams = [
    { id: "t1", name: "Los Locos Padel", roster: ["Marco Rossi", "Luca Bianchi"] },
    { id: "t2", name: "Smash Taranto", roster: ["Giulia Verdi", "Anna Neri", "Sara Blu"] },
    { id: "t3", name: "Bandeja Club", roster: ["Paolo Gialli", "Enzo Viola"] },
    { id: "t4", name: "Vibora Team", roster: ["Rosa Marrone", "Tina Grigi", "Uma Rosa"] },
    { id: "t5", name: "Chiquita Padel", roster: ["Diego Azzurri", "Elio Fumo"] },
    { id: "t6", name: "Rulo Squad", roster: ["Franco Celeste", "Mimmo Sole"] },
  ];
  for (const t of teams) await setDoc(doc(collection(db, "teams"), t.id), t);

  const editionTeams = [
    { editionId: "e-serieb-2526", teamId: "t1", points: 9, played: 4, order: 0, status: "normale" },
    { editionId: "e-serieb-2526", teamId: "t2", points: 7, played: 4, order: 0, status: "normale" },
    { editionId: "e-serieb-2526", teamId: "t3", points: 4, played: 4, order: 0, status: "normale" },
    { editionId: "e-serieb-2526", teamId: "t4", points: 0, played: 3, order: 0, status: "ritirata" },
  ];
  for (const et of editionTeams) {
    const id = `${et.editionId}_${et.teamId}`;
    await setDoc(doc(collection(db, "editionTeams"), id), { id, ...et });
  }

  const femaleParticipants = [
    { name: "Chiara Esposito", points: 340, stages: 3, status: "normale" },
    { name: "Ilaria Greco", points: 300, stages: 3, status: "normale" },
    { name: "Noemi Russo", points: 260, stages: 2, status: "normale" },
  ];
  for (const [i, fp] of femaleParticipants.entries()) {
    const id = `e-femm-2026_${i}`;
    await setDoc(doc(collection(db, "femaleParticipants"), id), { id, editionId: "e-femm-2026", ...fp });
  }

  await setDoc(doc(collection(db, "homeNews"), "news-1"), {
    id: "news-1",
    title: "Aperte le iscrizioni al torneo estivo",
    body: "Da lunedì è possibile iscriversi al torneo estivo di padel. Posti limitati, affrettatevi!",
    date: new Date().toISOString().slice(0, 10),
    status: "pubblicato",
  });

  console.log("Seed completato.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Errore durante il seed:", err);
  process.exit(1);
});
