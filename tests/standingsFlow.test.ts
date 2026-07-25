import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchTotals, compareStandingRows } from "../src/lib/standingsEngine.ts";
import { derivePermissions } from "../src/lib/permissions.ts";

// --- Scenario 5 / Fase 17.1-17.3: baseline + partite + correzione manuale -------------

test("baseline 20 punti + vittoria 2-0 = 23 punti finali (la baseline non si perde)", () => {
  const baselinePoints = 20;
  const manualPointsAdjustment = 0;
  const totals = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-0" as const }]);
  const matchPoints = totals.get("A")?.points ?? 0;
  const finalPoints = baselinePoints + matchPoints + manualPointsAdjustment;
  assert.equal(finalPoints, 23);
});

test("baselinePlayed 8 + una nuova partita conclusa = 9 partite giocate finali", () => {
  const baselinePlayed = 8;
  const manualPlayedAdjustment = 0;
  const totals = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-1" as const }]);
  const matchPlayed = totals.get("A")?.played ?? 0;
  const finalPlayed = baselinePlayed + matchPlayed + manualPlayedAdjustment;
  assert.equal(finalPlayed, 9);
});

test("manualPointsAdjustment -1 riduce correttamente il totale finale", () => {
  const baselinePoints = 10;
  const manualPointsAdjustment = -1;
  const totals = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-1" as const }]);
  const matchPoints = totals.get("A")?.points ?? 0; // 2
  const finalPoints = baselinePoints + matchPoints + manualPointsAdjustment;
  assert.equal(finalPoints, 11);
});

// --- Scenario 3: correzione 2-0 -> 1-2, il totale non conserva i vecchi punti ---------

test("correggere 2-0 in 1-2 aggiorna il totale senza lasciare punti del vecchio risultato", () => {
  const totalsBefore = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-0" as const }]);
  assert.equal(totalsBefore.get("A")?.points, 3);

  const totalsAfter = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "1-2" as const }]);
  assert.equal(totalsAfter.get("A")?.points, 1);
  assert.equal(totalsAfter.get("B")?.points, 2);
});

// --- Scenario: completed -> cancelled non assegna più punti ---------------------------

test("una partita conclusa trasformata in annullata non contribuisce più ai totali", () => {
  const totals = computeMatchTotals([{ team1Id: "A", team2Id: "B", status: "annullata" as const, result: undefined }]);
  assert.equal(totals.size, 0);
});

// --- Fase 4/17.6-17.7: salvataggio massivo, più risultati e blocco su voce invalida ---

test("più risultati validi in un salvataggio massivo producono totali corretti per ciascuna squadra", () => {
  const totals = computeMatchTotals([
    { team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "2-0" as const },
    { team1Id: "C", team2Id: "D", status: "conclusa" as const, result: "1-2" as const },
    { team1Id: "A", team2Id: "C", status: "conclusa" as const, result: "2-1" as const },
  ]);
  assert.deepEqual(totals.get("A"), { points: 5, played: 2 }); // 3 (2-0) + 2 (2-1)
  assert.deepEqual(totals.get("B"), { points: 0, played: 1 });
  assert.deepEqual(totals.get("C"), { points: 2, played: 2 }); // 1 (1-2 come team1) + 1 (2-1 come team2)
  assert.deepEqual(totals.get("D"), { points: 2, played: 1 });
});

test("una voce con risultato non valido viene ignorata dal calcolo dei totali (non genera punti fantasma)", () => {
  const totals = computeMatchTotals([
    { team1Id: "A", team2Id: "B", status: "conclusa" as const, result: "3-1" as unknown as "2-0" },
  ]);
  assert.equal(totals.size, 0);
});

// --- Fase 7/17.8-17.12: permessi distinti per ruolo -----------------------------------

test("superadmin ha tutti i permessi", () => {
  const p = derivePermissions("superAdmin");
  assert.equal(p.isSuperAdmin, true);
  assert.equal(p.isAdmin, true);
  assert.equal(p.canCreateMatches, true);
  assert.equal(p.canDeleteMatches, true);
  assert.equal(p.canEditResults, true);
  assert.equal(p.canManageMatchdays, true);
  assert.equal(p.canCreateHomeNewsDraft, true);
});

test("admin può creare/eliminare partite e giornate, correggere risultati", () => {
  const p = derivePermissions("admin");
  assert.equal(p.isAdmin, true);
  assert.equal(p.canCreateMatches, true);
  assert.equal(p.canDeleteMatches, true);
  assert.equal(p.canEditResults, true);
  assert.equal(p.canManageMatchdays, true);
  assert.equal(p.canCreateHomeNewsDraft, false);
});

test("il resultManager può modificare i risultati ma non creare o eliminare partite/giornate", () => {
  const p = derivePermissions("resultManager");
  assert.equal(p.isResultManager, true);
  assert.equal(p.canEditResults, true);
  assert.equal(p.canCreateMatches, false);
  assert.equal(p.canDeleteMatches, false);
  assert.equal(p.canManageMatchdays, false);
  assert.equal(p.canCreateHomeNewsDraft, false);
});

test("un utente senza ruolo non ha alcun permesso", () => {
  const p = derivePermissions(undefined);
  assert.equal(p.canEditResults, false);
  assert.equal(p.canCreateMatches, false);
  assert.equal(p.canManageMatchdays, false);
});

// --- Fase 12/17.17: ordinamento classifica con spareggio per ordine importato --------

test("compareStandingRows mette lo stato normale prima di ritirata/squalificata", () => {
  const rows = [
    { status: "ritirata", points: 50, order: 0 },
    { status: "normale", points: 10, order: 0 },
  ];
  const sorted = [...rows].sort(compareStandingRows);
  assert.equal(sorted[0].status, "normale");
});

test("compareStandingRows ordina per punti decrescenti", () => {
  const rows = [
    { status: "normale", points: 10, order: 0 },
    { status: "normale", points: 20, order: 0 },
  ];
  const sorted = [...rows].sort(compareStandingRows);
  assert.equal(sorted[0].points, 20);
});

test("compareStandingRows usa l'ordine importato/manuale per spareggiare i pari punti", () => {
  const rows = [
    { status: "normale", points: 10, order: 3 },
    { status: "normale", points: 10, order: 1 },
    { status: "normale", points: 10, order: 2 },
  ];
  const sorted = [...rows].sort(compareStandingRows);
  assert.deepEqual(sorted.map((r) => r.order), [1, 2, 3]);
});
