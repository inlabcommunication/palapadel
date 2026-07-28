import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError, verifyCaller } from "../_lib/auth.js";
import { parseBody, z } from "../_lib/validation.js";

export default async function handler(req, res) {
  try {
    requirePost(req);
    parseBody(z.object({}).strict(), req.body);
    const app = getAdminApp();
    await verifyCaller(app, req, ["superAdmin"]);
    const db = admin.firestore(app);

    const [settingsSnap, installationsSnap, tokensSnap, historySnap] = await Promise.all([
      db.doc("notificationSettings/global").get(),
      db.collection("notificationInstallations").get(),
      db.collectionGroup("tokens").get(),
      db.collection("notificationHistory").orderBy("createdAt", "desc").limit(20).get(),
    ]);

    const serviceAccountConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
    const vapidConfigured = Boolean(process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY);
    const grantedDevices = installationsSnap.docs.filter((doc) => {
      const data = doc.data();
      return data.permission === "granted" && data.notificationsEnabled !== false;
    }).length;
    const validTokens = tokensSnap.docs.filter((doc) => typeof doc.data().token === "string" && doc.data().token.length > 20).length;
    const recentFailures = historySnap.docs.reduce((total, doc) => total + Number(doc.data().failureCount ?? 0), 0);
    const recentSuccesses = historySnap.docs.reduce((total, doc) => total + Number(doc.data().successCount ?? 0), 0);

    let status = "Configurato";
    if (!serviceAccountConfigured || !vapidConfigured || !settingsSnap.exists) status = "Configurazione incompleta";
    else if (grantedDevices === 0 || validTokens === 0) status = "Nessun dispositivo registrato";
    else if (recentFailures > 0 && recentSuccesses > 0) status = "Invio parziale";
    else if (recentFailures > 0) status = "Token non validi";
    else if (recentSuccesses > 0) status = "Invio riuscito";

    res.status(200).json({
      ok: true,
      diagnostics: {
        status,
        firebaseAdmin: serviceAccountConfigured ? "Configurato" : "Configurazione incompleta",
        serverCredentials: serviceAccountConfigured ? "Configurato" : "Configurazione incompleta",
        vapidKey: vapidConfigured ? "Configurato" : "Configurazione incompleta",
        serviceWorker: "Configurato",
        endpoint: "Configurato",
        settings: settingsSnap.exists ? "Configurato" : "Configurazione incompleta",
        registeredDevices: installationsSnap.size,
        enabledDevices: grantedDevices,
        validTokens,
        recentFailures,
        recentSuccesses,
        message: grantedDevices === 0 || validTokens === 0 ? "Nessun dispositivo abilitato alle notifiche." : null,
      },
    });
  } catch (err) {
    sendError(res, err, "Errore Firebase durante la diagnostica notifiche");
  }
}
