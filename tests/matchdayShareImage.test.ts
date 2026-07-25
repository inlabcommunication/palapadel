import test from "node:test";
import assert from "node:assert/strict";
import {
  MATCHDAY_SHARE_HEIGHT,
  MATCHDAY_SHARE_WIDTH,
  matchMetaParts,
  paginateMatchdayMatches,
} from "../src/lib/matchdayShareImage.ts";

test("la giornata usa il formato verticale 1080x1920", () => {
  assert.equal(MATCHDAY_SHARE_WIDTH, 1080);
  assert.equal(MATCHDAY_SHARE_HEIGHT, 1920);
});

test("le giornate lunghe vengono paginate senza perdere partite", () => {
  const matches = Array.from({ length: 14 }, (_, index) => index);
  assert.deepEqual(paginateMatchdayMatches(matches).flat(), matches);
  assert.equal(paginateMatchdayMatches(matches).length, 3);
});

test("data ora e campo sono omessi quando assenti", () => {
  assert.deepEqual(matchMetaParts({ homeTeam: "A", awayTeam: "B", status: "da_giocare" }), []);
  assert.deepEqual(matchMetaParts({ homeTeam: "A", awayTeam: "B", status: "da_giocare", matchTime: "20:30" }), ["ore 20:30"]);
});
