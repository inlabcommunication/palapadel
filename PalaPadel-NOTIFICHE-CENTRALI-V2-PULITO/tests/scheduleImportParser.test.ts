import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleText } from "../src/lib/scheduleImportParser.ts";

test("parsa un calendario testuale diviso per giornate", () => {
  const rows = parseScheduleText("Giornata 1\nTeam A - Team B | 10/01/2027 | 20:30 | Campo 1");
  assert.deepEqual(rows, [{
    matchdayNumber: 1,
    homeTeamName: "Team A",
    awayTeamName: "Team B",
    matchDate: "2027-01-10",
    matchTime: "20:30",
    court: "Campo 1",
  }]);
});

test("parsa righe tabellari esportate da Excel", () => {
  const rows = parseScheduleText("2;2027-01-17;21:00;Team C;Team D;Campo 2;Nota");
  assert.equal(rows[0].matchdayNumber, 2);
  assert.equal(rows[0].homeTeamName, "Team C");
  assert.equal(rows[0].awayTeamName, "Team D");
  assert.equal(rows[0].notes, "Nota");
});
