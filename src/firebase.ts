import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Le chiavi arrivano da variabili d'ambiente (vedi .env.example).
// Su Vercel vanno impostate come Environment Variables del progetto.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Il Super Amministratore deve poter creare nuovi account senza perdere
 * la propria sessione. createUserWithEmailAndPassword sull'app principale
 * autenticherebbe automaticamente il nuovo utente al posto suo.
 * Soluzione compatibile col piano Spark (nessuna Cloud Function):
 * si usa una seconda istanza "usa e getta" dell'app Firebase solo per
 * la creazione dell'account, poi la si scarta.
 */
export function getSecondaryAuth() {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  return getAuth(secondaryApp);
}
