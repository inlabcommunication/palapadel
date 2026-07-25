import { admin } from "./firebaseAdmin.js";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function requirePost(req) {
  if (req.method !== "POST") throw new HttpError(405, "Metodo non consentito");
}

export async function verifyCaller(app, req, allowedRoles = []) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) throw new HttpError(401, "Token mancante");

  const decoded = await admin.auth(app).verifyIdToken(idToken);
  const callerSnap = await admin.firestore(app).doc(`users/${decoded.uid}`).get();
  if (!callerSnap.exists) throw new HttpError(403, "Utente non registrato");

  const callerData = callerSnap.data();
  if (callerData.disabled) throw new HttpError(403, "Account disattivato");
  if (allowedRoles.length > 0 && !allowedRoles.includes(callerData.role)) {
    throw new HttpError(403, "Permessi insufficienti");
  }

  return {
    uid: decoded.uid,
    username: callerData.username ?? decoded.uid,
    role: callerData.role,
  };
}

export function sendError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, error: err.message, details: err.details });
    return;
  }
  console.error(err);
  res.status(500).json({ ok: false, error: fallbackMessage });
}
