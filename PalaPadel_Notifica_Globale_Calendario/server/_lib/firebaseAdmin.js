import admin from "firebase-admin";

export function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (serviceAccount.project_id ? `${serviceAccount.project_id}.appspot.com` : undefined);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

export { admin };
