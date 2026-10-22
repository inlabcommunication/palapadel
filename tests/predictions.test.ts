import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPeriod,
  isMatchOpen,
  isPredictionVoided,
  kickoffTime,
  nicknameError,
  normalizeNickname,
  periodForMatch,
  scorePrediction,
  sortLeaderboard,
} from "../shared/predictions.js";
import { rebuildPredictionLeaderboards, scoreMatchPredictions } from "../server/_lib/predictionScoring.js";
import { createFakeDb } from "./helpers/fakeFirestore.ts";

test("punti: 3 risultato esatto, 1 vincitore giusto, 0 sbagliato, niente se non conclusa", () => {
  const done = (result: string) => ({ editionId: "e", status: "conclusa", result });
  assert.deepEqual(scorePrediction("2-1", done("2-1")), { points: 3, exact: true });
  assert.deepEqual(scorePrediction("2-0", done("2-1")), { points: 1, exact: false });
  assert.deepEqual(scorePrediction("0-2", done("2-1")), { points: 0, exact: false });
  assert.deepEqual(scorePrediction("1-2", done("0-2")), { points: 1, exact: false });
  assert.equal(scorePrediction("2-1", { editionId: "e", status: "rinviata" }), null);
  assert.equal(scorePrediction("2-1", { editionId: "e", status: "annullata", result: "2-1" }), null);
});

test("chiusura: ora italiana, con ora legale e solare", () => {
  // 21 ottobre 2026 20:30 a Roma = 18:30 UTC (ora legale), 15 dicembre 20:30 = 19:30 UTC.
  assert.equal(new Date(kickoffTime("2026-10-21", "20:30")!).toISOString(), "2026-10-21T18:30:00.000Z");
  assert.equal(new Date(kickoffTime("2026-12-15", "20:30")!).toISOString(), "2026-12-15T19:30:00.000Z");
  // Senza orario: mezzanotte del giorno.
  assert.equal(new Date(kickoffTime("2026-12-15")!).toISOString(), "2026-12-14T23:00:00.000Z");
  assert.equal(kickoffTime(undefined), null);
  const match = { editionId: "e", status: "da_giocare", matchDate: "2026-12-15", matchTime: "20:30" };
  assert.equal(isMatchOpen(match, Date.parse("2026-12-15T19:29:00Z")), true);
  assert.equal(isMatchOpen(match, Date.parse("2026-12-15T19:30:00Z")), false);
  assert.equal(isMatchOpen({ editionId: "e", status: "da_giocare" }), true);
  assert.equal(isMatchOpen({ ...match, status: "rinviata" }, 0), false);
});

const periods = [
  { id: "p1", name: "Autunno", startDate: "2026-09-01", endDate: "2026-12-31", editionIds: ["serieA", "serieB"] },
  { id: "p2", name: "Inverno", startDate: "2027-01-01", endDate: "2027-03-31", editionIds: ["serieA"] },
];

test("periodi: in corso oggi e periodo di una partita (campionato e data)", () => {
  assert.equal(currentPeriod(periods, Date.parse("2026-10-22T10:00:00Z"))?.id, "p1");
  assert.equal(currentPeriod(periods, Date.parse("2027-06-01T10:00:00Z")), null);
  assert.equal(currentPeriod([{ ...periods[0], closedAt: "x" }], Date.parse("2026-10-22T10:00:00Z")), null);
  assert.equal(periodForMatch(periods, { editionId: "serieB", status: "conclusa", matchDate: "2026-11-10" })?.id, "p1");
  assert.equal(periodForMatch(periods, { editionId: "serieB", status: "conclusa", matchDate: "2027-02-10" }), null);
  assert.equal(periodForMatch(periods, { editionId: "serieA", status: "conclusa" }, Date.parse("2027-02-10T10:00:00Z"))?.id, "p2");
});

test("classifica: punti, poi esatti, poi iscrizione più vecchia", () => {
  const sorted = sortLeaderboard([
    { nickname: "c", points: 5, exact: 1, joinedAt: "2026-01-03" },
    { nickname: "a", points: 5, exact: 1, joinedAt: "2026-01-01" },
    { nickname: "b", points: 5, exact: 2, joinedAt: "2026-01-05" },
    { nickname: "d", points: 9, exact: 0, joinedAt: "2026-01-09" },
  ]);
  assert.deepEqual(sorted.map((e) => e.nickname), ["d", "b", "a", "c"]);
});

test("nickname: lunghezza, caratteri ammessi e confronto senza maiuscole/accenti", () => {
  assert.equal(nicknameError("Mario_88"), null);
  assert.match(nicknameError("ab") ?? "", /3 a 20/);
  assert.match(nicknameError("<script>") ?? "", /Usa solo/);
  assert.equal(normalizeNickname("Nicolò Padel"), normalizeNickname("nicolo-padel"));
});

function baseDb() {
  return createFakeDb({
    "predictionPeriods/p1": periods[0],
    "predictionPlayers/u1": { uid: "u1", nickname: "Ace", createdAt: "2026-09-01" },
    "predictionPlayers/u2": { uid: "u2", nickname: "Lob", createdAt: "2026-09-02" },
    "matches/m1": { editionId: "serieA", matchdayId: "g1", status: "da_giocare", matchDate: "2026-10-20" },
    "predictions/u1_m1": { uid: "u1", matchId: "m1", editionId: "serieA", pick: "2-1" },
    "predictions/u2_m1": { uid: "u2", matchId: "m1", editionId: "serieA", pick: "2-0" },
  });
}

test("risultato salvato: punti in classifica, correzione e annullamento senza doppi conteggi", async () => {
  const db = baseDb();
  const board = () => db.store.get("predictionLeaderboards/p1")?.entries;

  db.store.get("matches/m1")!.status = "conclusa";
  db.store.get("matches/m1")!.result = "2-1";
  await scoreMatchPredictions(db, "m1");
  assert.deepEqual(board().u1, { nickname: "Ace", joinedAt: "2026-09-01", points: 3, exact: 1, played: 1 });
  assert.equal(board().u2.points, 1);

  // Stesso risultato salvato di nuovo: nessun cambiamento.
  await scoreMatchPredictions(db, "m1");
  assert.equal(board().u1.points, 3);
  assert.equal(board().u1.played, 1);

  // Correzione 2-1 → 2-0: i punti si scambiano.
  db.store.get("matches/m1")!.result = "2-0";
  await scoreMatchPredictions(db, "m1");
  assert.equal(board().u1.points, 1);
  assert.equal(board().u2.points, 3);
  assert.equal(board().u2.exact, 1);

  // Partita annullata: punti tolti.
  db.store.get("matches/m1")!.status = "annullata";
  await scoreMatchPredictions(db, "m1");
  assert.deepEqual([board().u1.points, board().u1.played, board().u2.points], [0, 0, 0]);
  assert.equal(db.store.get("predictions/u1_m1")!.points, null);

  // Ricostruzione completa coerente con lo stato attuale.
  db.store.get("matches/m1")!.status = "conclusa";
  db.store.get("matches/m1")!.result = "2-1";
  await rebuildPredictionLeaderboards(db);
  assert.equal(board().u1.points, 3);
  assert.equal(board().u2.points, 1);

  // Partita eliminata: punti tolti e pronostici cancellati.
  db.store.delete("matches/m1");
  await scoreMatchPredictions(db, "m1");
  assert.equal(board().u1.points, 0);
  assert.equal(db.store.has("predictions/u1_m1"), false);
});

test("campionato non incluso nel periodo: nessun punto in classifica", async () => {
  const db = baseDb();
  Object.assign(db.store.get("matches/m1")!, { editionId: "serieC", status: "conclusa", result: "2-1" });
  await scoreMatchPredictions(db, "m1");
  assert.equal(db.store.get("predictions/u1_m1")!.points, 3);
  assert.equal(db.store.get("predictions/u1_m1")!.scoredPeriodId, null);
  assert.equal(db.store.has("predictionLeaderboards/p1"), false);
});

test("inizio reale indicato dallo staff: chiude i pronostici e annulla quelli fatti dopo", async () => {
  const match = { editionId: "serieA", status: "da_giocare", predictionsClosedAt: "2026-10-20T18:00:00.000Z" };
  assert.equal(isMatchOpen(match, Date.parse("2026-10-20T17:59:00Z")), true);
  assert.equal(isMatchOpen(match, Date.parse("2026-10-20T18:00:00Z")), false);

  const db = baseDb();
  Object.assign(db.store.get("matches/m1")!, { status: "conclusa", result: "2-1", predictionsClosedAt: "2026-10-20T18:00:00.000Z" });
  db.store.get("predictions/u1_m1")!.updatedAt = "2026-10-20T18:05:00.000Z"; // dopo l'inizio: annullato
  db.store.get("predictions/u2_m1")!.updatedAt = "2026-10-20T17:00:00.000Z"; // prima: vale
  await scoreMatchPredictions(db, "m1");
  const entries = db.store.get("predictionLeaderboards/p1")!.entries;
  assert.equal(entries.u1, undefined);
  assert.equal(entries.u2.points, 1);
  assert.equal(db.store.get("predictions/u1_m1")!.voided, true);
  assert.equal(db.store.get("predictions/u1_m1")!.points, null);
});
