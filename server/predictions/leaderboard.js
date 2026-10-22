import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { requirePost, sendError } from "../_lib/auth.js";
import { documentId, parseBody, z } from "../_lib/validation.js";
import { currentPeriod, sortLeaderboard } from "../../shared/predictions.js";
import { verifyPlayerToken } from "../_lib/playerAuth.js";

function publicPeriod(period) {
  return {
    id: period.id,
    name: period.name,
    startDate: period.startDate,
    endDate: period.endDate,
    editionIds: period.editionIds ?? [],
    closedAt: period.closedAt ?? null,
    winners: period.winners ?? [],
  };
}

// Pubblico: periodi della gara e classifica (solo nickname e punti, mai email o uid).
export default async function handler(req, res) {
  try {
    requirePost(req);
    const { periodId } = parseBody(z.object({ periodId: documentId.optional() }).strict(), req.body);
    const app = getAdminApp();
    const db = admin.firestore(app);
    // Facoltativo: se chi chiede ha fatto l'accesso, la sua riga viene evidenziata.
    const myUid = await verifyPlayerToken(app, req).then((decoded) => decoded.uid, () => null);
    const periodsSnap = await db.collection("predictionPeriods").get();
    const periods = periodsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    const current = currentPeriod(periods);
    const selected = periods.find((period) => period.id === periodId) ?? current ?? periods[0] ?? null;
    let leaderboard = [];
    if (selected) {
      const board = await db.doc(`predictionLeaderboards/${selected.id}`).get();
      const entries = Object.entries(board.exists ? board.data().entries ?? {} : {})
        .map(([uid, entry]) => ({ ...entry, isMe: uid === myUid }))
        .filter((entry) => entry.played > 0);
      leaderboard = sortLeaderboard(entries).map((entry, index) => ({
        position: index + 1,
        nickname: entry.nickname,
        points: entry.points ?? 0,
        exact: entry.exact ?? 0,
        played: entry.played ?? 0,
        ...(entry.isMe ? { isMe: true } : {}),
      }));
    }
    res.status(200).json({
      ok: true,
      periods: periods.map(publicPeriod),
      currentPeriodId: current?.id ?? null,
      selectedPeriodId: selected?.id ?? null,
      leaderboard,
    });
  } catch (err) {
    sendError(res, err, "Errore nel caricamento della classifica");
  }
}
