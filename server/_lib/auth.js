import { admin } from "./firebaseAdmin.js";
import { normalizeRole } from "./roles.js";

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
  const role = normalizeRole(callerData.role);
  if (!role || (allowedRoles.length > 0 && !allowedRoles.includes(role))) {
    throw new HttpError(403, "Permessi insufficienti");
  }

  return {
    uid: decoded.uid,
    username: callerData.username ?? decoded.uid,
    role,
  };
}

export function sendError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    if (err.details?.code === "VALIDATION_ERROR") {
      res.status(err.status).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          fields: err.details.fields ?? {},
        },
      });
      return;
    }
    res.status(err.status).json({ success: false, error: { code: "REQUEST_ERROR", message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: fallbackMessage } });
}
