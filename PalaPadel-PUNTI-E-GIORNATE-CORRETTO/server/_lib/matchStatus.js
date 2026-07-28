export const RESULT_VALUES = ["2-0", "2-1", "1-2", "0-2"];

export const API_STATUS_TO_STORED = {
  scheduled: "da_giocare",
  completed: "conclusa",
  postponed: "rinviata",
  cancelled: "annullata",
  da_giocare: "da_giocare",
  conclusa: "conclusa",
  rinviata: "rinviata",
  annullata: "annullata",
};

export const STORED_STATUS_TO_API = {
  da_giocare: "scheduled",
  conclusa: "completed",
  rinviata: "postponed",
  annullata: "cancelled",
};

export function isValidResult(result) {
  return RESULT_VALUES.includes(result);
}

export function normalizeApiStatus(status) {
  if (status === undefined || status === null || status === "") return null;
  return API_STATUS_TO_STORED[status] ?? null;
}

export function normalizeMatchChange(entry) {
  const hasResult = entry.result !== undefined && entry.result !== null;
  const hasStatus = entry.status !== undefined && entry.status !== null && entry.status !== "";
  const status = hasStatus ? normalizeApiStatus(entry.status) : hasResult ? "conclusa" : null;

  if (!status) {
    return { ok: false, error: "status non valido o mancante" };
  }
  if (hasResult && !isValidResult(entry.result)) {
    return { ok: false, error: `risultato "${entry.result}" non valido` };
  }
  if (status === "conclusa" && !hasResult) {
    return { ok: false, error: "status completed richiede un risultato valido" };
  }
  if (status !== "conclusa" && hasResult) {
    return { ok: false, error: "un risultato puo essere salvato solo con status completed" };
  }

  return {
    ok: true,
    status,
    result: status === "conclusa" ? entry.result : null,
  };
}
