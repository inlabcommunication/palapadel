// Pronostici PalaPadel: regole condivise tra app e backend.
//
// - Si pronostica il risultato di ogni partita: 2-0, 2-1, 1-2, 0-2.
// - 3 punti per il risultato esatto, 1 punto per il vincitore giusto con punteggio
//   sbagliato. Partite rinviate o annullate: nessun punto.
// - I pronostici si chiudono all'orario d'inizio della partita (ora italiana); senza
//   orario alle 00:00 del giorno; senza data finché la partita è da giocare.
// - Lo staff può indicare l'orario reale d'inizio (match.predictionsClosedAt): da quel
//   momento non si gioca più e i pronostici fatti o modificati dopo vengono annullati.
// - La gara è divisa in periodi scelti dal Super Admin, ognuno con i suoi campionati:
//   la classifica riparte da zero a ogni periodo.

export const PICKS = ["2-0", "2-1", "1-2", "0-2"];
export const EXACT_POINTS = 3;
export const WINNER_POINTS = 1;
export const TIME_ZONE = "Europe/Rome";

function winnerOf(result) {
  return Number(result[0]) > Number(result[2]) ? 1 : 2;
}

/** null se la partita non assegna punti (non conclusa, rinviata, annullata). */
export function scorePrediction(pick, match) {
  if (!match || match.status !== "conclusa" || !PICKS.includes(match.result) || !PICKS.includes(pick)) return null;
  if (pick === match.result) return { points: EXACT_POINTS, exact: true };
  if (winnerOf(pick) === winnerOf(match.result)) return { points: WINNER_POINTS, exact: false };
  return { points: 0, exact: false };
}

function zoneOffsetMinutes(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** Data/ora italiane ("2026-10-21", "20:30") in millisecondi UTC; null se la data non è valida. */
export function kickoffTime(matchDate, matchTime, timeZone = TIME_ZONE) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(matchDate ?? ""));
  if (!date) return null;
  const time = /^(\d{1,2}):(\d{2})$/.exec(String(matchTime ?? "")) ?? [null, "0", "0"];
  const guess = Date.UTC(+date[1], +date[2] - 1, +date[3], +time[1], +time[2]);
  let utc = guess - zoneOffsetMinutes(guess, timeZone) * 60000;
  // Correzione nei giorni del cambio d'ora.
  const offset = zoneOffsetMinutes(utc, timeZone);
  utc = guess - offset * 60000;
  return utc;
}

/** Data di oggi in Italia, "AAAA-MM-GG". */
export function todayInItaly(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

/** Pronostico fatto (o modificato) dopo l'inizio reale indicato dallo staff: non vale. */
export function isPredictionVoided(prediction, match) {
  const closedAt = Date.parse(match?.predictionsClosedAt ?? "");
  const madeAt = Date.parse(prediction?.updatedAt ?? prediction?.createdAt ?? "");
  return Number.isFinite(closedAt) && Number.isFinite(madeAt) && madeAt >= closedAt;
}

export function isMatchOpen(match, now = Date.now()) {
  if (!match || match.status !== "da_giocare" || match.result) return false;
  const closedAt = Date.parse(match.predictionsClosedAt ?? "");
  if (Number.isFinite(closedAt) && now >= closedAt) return false;
  const kickoff = kickoffTime(match.matchDate, match.matchTime);
  return kickoff === null || now < kickoff;
}

/** Periodo in corso oggi (date incluse), il più recente se più d'uno. */
export function currentPeriod(periods, now = Date.now()) {
  const today = todayInItaly(now);
  return [...periods]
    .filter((period) => !period.closedAt && period.startDate <= today && today <= period.endDate)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null;
}

/**
 * Periodo a cui appartiene una partita: campionato incluso e data della partita
 * dentro le date del periodo. Senza data conta il giorno in cui arriva il risultato.
 */
export function periodForMatch(periods, match, now = Date.now()) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(match?.matchDate ?? "")) ? match.matchDate : todayInItaly(now);
  return [...periods]
    .filter((period) => (period.editionIds ?? []).includes(match.editionId) && period.startDate <= day && day <= period.endDate)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null;
}

/** Ordine della classifica: punti, poi risultati esatti, poi chi si è iscritto prima. */
export function sortLeaderboard(entries) {
  return [...entries].sort(
    (a, b) =>
      (b.points ?? 0) - (a.points ?? 0) ||
      (b.exact ?? 0) - (a.exact ?? 0) ||
      String(a.joinedAt ?? "").localeCompare(String(b.joinedAt ?? ""))
  );
}

export function normalizeNickname(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Nickname: 3-20 caratteri tra lettere, numeri, spazio, punto, trattino e underscore. */
export function nicknameError(value) {
  const nickname = String(value ?? "").trim();
  if (nickname.length < 3 || nickname.length > 20) return "Il nickname deve avere da 3 a 20 caratteri.";
  if (!/^[\p{L}\p{N} ._-]+$/u.test(nickname)) return "Usa solo lettere, numeri, spazi, punti, trattini e underscore.";
  if (normalizeNickname(nickname).length < 3) return "Il nickname deve contenere almeno 3 lettere o numeri.";
  return null;
}
