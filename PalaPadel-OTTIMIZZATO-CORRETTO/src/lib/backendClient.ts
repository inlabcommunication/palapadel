import { auth } from "../firebase";

/**
 * Client HTTP condiviso per tutti gli endpoint backend (api/matches/*.js,
 * api/standings/*.js). Centralizza: token Firebase ID, gestione errori HTTP/rete,
 * parsing della risposta. Nessun componente e nessun altro modulo deve chiamare
 * fetch() direttamente verso questi endpoint.
 */
export class BackendApiError extends Error {
  status?: number;
  details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.details = details;
  }
}

async function getIdTokenOrThrow(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new BackendApiError("Sessione scaduta: effettua di nuovo l'accesso.", 401);
  }
  return user.getIdToken();
}

export async function postToBackend<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const idToken = await getIdTokenOrThrow();

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendApiError("Impossibile contattare il server. Controlla la connessione e riprova.");
  }

  let json: {
    ok?: boolean;
    success?: boolean;
    error?: string | { code?: string; message?: string; fields?: Record<string, string> };
    details?: unknown;
  } = {};
  try {
    json = await response.json();
  } catch {
    // risposta non-JSON: tratteremo come errore generico sotto
  }

  if (!response.ok || (!json.ok && !json.success)) {
    const structuredError = typeof json.error === "object" ? json.error : null;
    const message = structuredError?.message || (typeof json.error === "string" ? json.error : "Operazione non riuscita.");
    throw new BackendApiError(message, response.status, structuredError?.fields ?? json.details);
  }

  return json as TResponse;
}
