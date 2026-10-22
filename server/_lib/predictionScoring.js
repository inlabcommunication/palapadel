import { isPredictionVoided, periodForMatch, scorePrediction } from "../../shared/predictions.js";

// Classifica di un periodo: un solo documento predictionLeaderboards/{periodId} con
// una voce per giocatore, così leggerla costa una sola lettura.

function emptyEntry(player) {
  return { nickname: player?.nickname ?? "Giocatore", joinedAt: player?.createdAt ?? null, points: 0, exact: 0, played: 0 };
}

function applyDelta(entry, delta, sign) {
  entry.points = (entry.points ?? 0) + sign * delta.points;
  entry.exact = (entry.exact ?? 0) + sign * delta.exact;
  entry.played = (entry.played ?? 0) + sign;
}

/** Punti di un pronostico; null se non ne assegna (partita non conclusa o pronostico annullato). */
function scoreFor(prediction, match) {
  if (!match || isPredictionVoided(prediction, match)) return null;
  return scorePrediction(prediction.pick, match);
}

function sameScore(prediction, score, periodId, voided) {
  return (
    (prediction.voided ?? false) === voided &&
    (prediction.points ?? null) === (score?.points ?? null) &&
    (prediction.exact ?? null) === (score?.exact ?? null) &&
    (prediction.scoredPeriodId ?? null) === (periodId ?? null)
  );
}

/**
 * Ricalcola i pronostici di una partita dopo il salvataggio di un risultato (o un
 * cambio di stato, o l'eliminazione). Idempotente: confronta con quanto già
 * assegnato e applica solo la differenza. Se la partita non esiste più, toglie i
 * punti ed elimina i pronostici.
 */
export async function scoreMatchPredictions(db, matchId, now = Date.now()) {
  return db.runTransaction(async (t) => {
    const matchSnap = await t.get(db.doc(`matches/${matchId}`));
    const match = matchSnap.exists ? matchSnap.data() : null;
    const predictionsSnap = await t.get(db.collection("predictions").where("matchId", "==", matchId));
    if (predictionsSnap.empty) return { changed: 0 };
    const periodsSnap = await t.get(db.collection("predictionPeriods"));
    const periods = periodsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const period = match ? periodForMatch(periods, match, now) : null;

    const changes = [];
    for (const doc of predictionsSnap.docs) {
      const prediction = doc.data();
      const score = scoreFor(prediction, match);
      const voided = isPredictionVoided(prediction, match);
      const periodId = score && period ? period.id : null;
      if (match && sameScore(prediction, score, periodId, voided)) continue;
      changes.push({ doc, prediction, score, periodId, voided });
    }
    if (changes.length === 0) return { changed: 0 };

    const boardIds = new Set();
    for (const change of changes) {
      if (change.prediction.scoredPeriodId) boardIds.add(change.prediction.scoredPeriodId);
      if (change.periodId) boardIds.add(change.periodId);
    }
    const boardRefs = [...boardIds].map((id) => db.doc(`predictionLeaderboards/${id}`));
    const boardSnaps = boardRefs.length ? await t.getAll(...boardRefs) : [];
    const boards = new Map(boardSnaps.map((snap) => [snap.id, { ...(snap.exists ? snap.data().entries ?? {} : {}) }]));
    const uids = [...new Set(changes.map((change) => change.prediction.uid))];
    const playerSnaps = await t.getAll(...uids.map((uid) => db.doc(`predictionPlayers/${uid}`)));
    const players = new Map(playerSnaps.map((snap) => [snap.id, snap.exists ? snap.data() : null]));

    for (const { prediction, score, periodId } of changes) {
      const uid = prediction.uid;
      if (prediction.scoredPeriodId && boards.has(prediction.scoredPeriodId)) {
        const entries = boards.get(prediction.scoredPeriodId);
        if (entries[uid]) applyDelta(entries[uid], { points: prediction.points ?? 0, exact: prediction.exact ? 1 : 0 }, -1);
      }
      if (periodId) {
        const entries = boards.get(periodId);
        entries[uid] = { ...emptyEntry(players.get(uid)), ...entries[uid] };
        applyDelta(entries[uid], { points: score.points, exact: score.exact ? 1 : 0 }, 1);
      }
    }

    const updatedAt = new Date(now).toISOString();
    for (const [id, entries] of boards) {
      t.set(db.doc(`predictionLeaderboards/${id}`), { periodId: id, entries, updatedAt });
    }
    for (const { doc, score, periodId, voided } of changes) {
      if (!match) {
        t.delete(doc.ref);
        continue;
      }
      t.update(doc.ref, {
        voided,
        points: score?.points ?? null,
        exact: score?.exact ?? null,
        scoredPeriodId: periodId,
        scoredResult: match.result ?? null,
        scoredAt: updatedAt,
      });
    }
    return { changed: changes.length };
  });
}

/** Non deve mai far fallire il salvataggio del risultato: in caso di errore si ricalcola dalla gestione. */
export async function scoreMatchPredictionsSafely(db, matchIds) {
  for (const matchId of new Set(matchIds)) {
    try {
      await scoreMatchPredictions(db, matchId);
    } catch (err) {
      console.error("Punti pronostici non aggiornati per la partita", matchId, err);
    }
  }
}

/** Ricostruisce da zero tutte le classifiche (pulsante "Ricalcola" del Super Admin). */
export async function rebuildPredictionLeaderboards(db, now = Date.now()) {
  const [predictionsSnap, periodsSnap, playersSnap, oldBoardsSnap] = await Promise.all([
    db.collection("predictions").get(),
    db.collection("predictionPeriods").get(),
    db.collection("predictionPlayers").get(),
    db.collection("predictionLeaderboards").get(),
  ]);
  const periods = periodsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const players = new Map(playersSnap.docs.map((doc) => [doc.id, doc.data()]));
  const matchIds = [...new Set(predictionsSnap.docs.map((doc) => doc.data().matchId))];
  const matches = new Map();
  for (let i = 0; i < matchIds.length; i += 100) {
    const snaps = await db.getAll(...matchIds.slice(i, i + 100).map((id) => db.doc(`matches/${id}`)));
    for (const snap of snaps) matches.set(snap.id, snap.exists ? snap.data() : null);
  }

  const boards = new Map(periods.map((period) => [period.id, {}]));
  const updates = [];
  const updatedAt = new Date(now).toISOString();
  for (const doc of predictionsSnap.docs) {
    const prediction = doc.data();
    const match = matches.get(prediction.matchId);
    if (!match) {
      updates.push({ ref: doc.ref, delete: true });
      continue;
    }
    const score = scoreFor(prediction, match);
    const period = score ? periodForMatch(periods, match, now) : null;
    if (score && period) {
      const entries = boards.get(period.id);
      entries[prediction.uid] ??= emptyEntry(players.get(prediction.uid));
      applyDelta(entries[prediction.uid], { points: score.points, exact: score.exact ? 1 : 0 }, 1);
    }
    updates.push({
      ref: doc.ref,
      data: {
        voided: isPredictionVoided(prediction, match),
        points: score?.points ?? null,
        exact: score?.exact ?? null,
        scoredPeriodId: score && period ? period.id : null,
        scoredResult: match.result ?? null,
        scoredAt: updatedAt,
      },
    });
  }

  const writes = [
    ...updates.map((u) => (batch) => (u.delete ? batch.delete(u.ref) : batch.update(u.ref, u.data))),
    ...[...boards].map(([id, entries]) => (batch) => batch.set(db.doc(`predictionLeaderboards/${id}`), { periodId: id, entries, updatedAt })),
    ...oldBoardsSnap.docs.filter((doc) => !boards.has(doc.id)).map((doc) => (batch) => batch.delete(doc.ref)),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((write) => write(batch));
    await batch.commit();
  }
  return { predictions: predictionsSnap.size, periods: periods.length };
}
