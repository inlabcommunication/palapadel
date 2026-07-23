// Funzione serverless (gira su Vercel, non su Firebase — nessun piano Blaze necessario).
// Permette al Super Amministratore di cambiare la password di un altro account,
// cosa che il solo SDK client di Firebase non consente per motivi di sicurezza.
//
// Configurazione richiesta (vedi README):
//   - Variabile d'ambiente FIREBASE_SERVICE_ACCOUNT su Vercel, contenente per intero
//     il JSON della chiave di servizio scaricata da Firebase Console.

import admin from "firebase-admin";

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  try {
    const app = getAdminApp();
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: "Token mancante" });
      return;
    }

    const decoded = await admin.auth(app).verifyIdToken(idToken);

    // Verifica che chi chiama sia davvero Super Amministratore, leggendo Firestore
    // con i privilegi Admin (bypassa le regole, ma qui controlliamo noi stessi il ruolo).
    const callerSnap = await admin.firestore(app).doc(`users/${decoded.uid}`).get();
    const callerRole = callerSnap.exists ? callerSnap.data().role : null;
    if (callerRole !== "superadmin") {
      res.status(403).json({ error: "Solo il Super Amministratore può cambiare le password" });
      return;
    }

    const { targetUid, newPassword } = req.body || {};
    if (!targetUid || !newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: "Dati mancanti o password troppo corta (minimo 6 caratteri)" });
      return;
    }

    await admin.auth(app).updateUser(targetUid, { password: newPassword });

    await admin.firestore(app).collection("auditLog").add({
      actor: callerSnap.data().username,
      action: "cambia_password",
      detail: `Password aggiornata per uid ${targetUid}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore interno durante l'aggiornamento della password" });
  }
}
