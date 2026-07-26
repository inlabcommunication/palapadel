// Test reali delle Firestore Rules, tramite Firestore Emulator + @firebase/rules-unit-testing.
// NON sono test testuali/regex sul contenuto di firestore.rules: ogni test istanzia un
// contesto autenticato (o anonimo) e tenta una vera lettura/scrittura contro l'emulatore,
// verificando che venga accettata o rifiutata secondo le regole reali.
//
// Richiede l'emulatore Firestore in esecuzione (vedi package.json: npm run test:rules
// avvia l'emulatore automaticamente tramite `firebase emulators:exec`). Se eseguito senza
// emulatore attivo, la connessione fallisce e i test lo segnalano esplicitamente (non
// vengono declassati a test "sempre verdi" o sostituiti da controlli sul testo del file).

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "palapadel-rules-test";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("users/admin-uid").set({ uid: "admin-uid", username: "admin", role: "admin", createdAt: "2026-01-01" });
    await db.doc("users/superadmin-uid").set({ uid: "superadmin-uid", username: "superadmin", role: "superadmin", createdAt: "2026-01-01" });
    await db.doc("users/gestore-uid").set({ uid: "gestore-uid", username: "gestore", role: "gestore", createdAt: "2026-01-01" });
    await db.doc("users/disabled-admin-uid").set({
      uid: "disabled-admin-uid",
      username: "disabled-admin",
      role: "admin",
      disabled: true,
      createdAt: "2026-01-01",
    });
    await db.doc("championshipTypes/serie-b").set({ id: "serie-b", name: "Serie B", hasTeams: true, badgeColor: "serie-b" });
    await db.doc("championshipEditions/ed-attiva").set({ id: "ed-attiva", typeId: "serie-b", season: "2025/2026", status: "attiva", isPubliclyVisible: true });
    await db.doc("championshipEditions/ed-bozza").set({ id: "ed-bozza", typeId: "serie-b", season: "2026/2027", status: "bozza", isPubliclyVisible: false });
    await db.doc("championshipEditions/ed-nascosta").set({ id: "ed-nascosta", typeId: "serie-b", season: "2024/2025", status: "attiva", isPubliclyVisible: false });
    await db.doc("editionTeams/ed-attiva_t1").set({
      id: "ed-attiva_t1",
      editionId: "ed-attiva",
      teamId: "t1",
      points: 10,
      played: 4,
      order: 0,
      status: "normale",
    });
    await db.doc("matches/m1").set({
      id: "m1",
      editionId: "ed-attiva",
      matchdayId: "md1",
      team1Id: "t1",
      team2Id: "t2",
      status: "da_giocare",
    });
  });
}

test("un utente anonimo può leggere un'edizione attiva", async () => {
  await seedBaseData();
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.firestore().doc("championshipEditions/ed-attiva").get());
});

test("un utente anonimo NON può leggere un'edizione in bozza", async () => {
  await seedBaseData();
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("championshipEditions/ed-bozza").get());
});

test("un utente anonimo non puo leggere un'edizione attiva ma nascosta", async () => {
  await seedBaseData();
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("championshipEditions/ed-nascosta").get());
});

test("una news pubblicata ma disattivata non e leggibile dal pubblico", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("homeNews/news-disabled").set({
      title: "News disattivata",
      body: "Testo",
      status: "pubblicato",
      active: false,
    });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("homeNews/news-disabled").get());
});

test("un utente anonimo non può scrivere su editionTeams", async () => {
  await seedBaseData();
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("editionTeams/ed-attiva_t1").set({ points: 999 }));
});

test("un admin autenticato NON può scrivere direttamente su editionTeams (solo il backend con Admin SDK può)", async () => {
  await seedBaseData();
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(admin.firestore().doc("editionTeams/ed-attiva_t1").update({ points: 999 }));
});

test("un admin NON puo modificare campionati, squadre, News o Albo", async () => {
  await seedBaseData();
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(admin.firestore().doc("championshipTypes/serie-b").update({ name: "Serie B modificata" }));
  await assertFails(admin.firestore().doc("championshipEditions/ed-attiva").update({ season: "2026/2027" }));
  await assertFails(admin.firestore().doc("teams/t1").set({ name: "Team", roster: [] }));
  await assertFails(admin.firestore().doc("homeNews/n1").set({ title: "News", body: "Testo", date: "2026-07-25", status: "bozza" }));
  await assertFails(admin.firestore().doc("historicalWins/w1").set({ typeId: "serie-b", teamId: "t1", season: "2025/2026" }));
});

test("il superAdmin modifica le tipologie ma usa il backend per le squadre", async () => {
  await seedBaseData();
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  await assertFails(superAdmin.firestore().doc("championshipTypes/serie-b").update({ name: "Serie B" }));
  await assertFails(superAdmin.firestore().doc("teams/t1").set({ name: "Team", roster: [] }));
});

test("un resultManager NON può scrivere direttamente su editionTeams", async () => {
  await seedBaseData();
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(gestore.firestore().doc("editionTeams/ed-attiva_t1").update({ points: 999 }));
});

test("un resultManager NON può scrivere direttamente su matches (deve usare l'endpoint backend)", async () => {
  await seedBaseData();
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(gestore.firestore().doc("matches/m1").update({ result: "2-0", status: "conclusa" }));
});

test("un resultManager NON può creare una partita direttamente", async () => {
  await seedBaseData();
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(
    gestore.firestore().collection("matches").add({
      editionId: "ed-attiva",
      matchdayId: "md1",
      team1Id: "t1",
      team2Id: "t3",
      status: "da_giocare",
    })
  );
});

test("un admin NON può creare una partita direttamente (deve usare create-match)", async () => {
  await seedBaseData();
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(
    admin.firestore().collection("matches").add({
      editionId: "ed-attiva",
      matchdayId: "md1",
      team1Id: "t1",
      team2Id: "t3",
      status: "da_giocare",
    })
  );
});

test("il login legge un singolo documento usernameEmails (get) con successo", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("usernameEmails/mario-rossi").set({ email: "mario@example.com" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.firestore().doc("usernameEmails/mario-rossi").get());
});

test("nessuno può elencare (list) l'intera collezione usernameEmails", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("usernameEmails/mario-rossi").set({ email: "mario@example.com" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().collection("usernameEmails").get());
});

test("l'audit log non è leggibile pubblicamente", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("auditLog/log1").set({ actor: "x", action: "result_created", timestamp: "now" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("auditLog/log1").get());
});

test("un resultManager NON puo creare homeNews direttamente", async () => {
  await seedBaseData();
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(
    gestore.firestore().collection("homeNews").add({
      title: "Bozza risultato",
      body: "Testo",
      date: "2026-07-25",
      status: "bozza",
    })
  );
});

test("un account disabled non eredita permessi di ruolo nelle rules client", async () => {
  await seedBaseData();
  const disabledAdmin = testEnv.authenticatedContext("disabled-admin-uid");

  await assertSucceeds(disabledAdmin.firestore().doc("users/disabled-admin-uid").get());
  await assertFails(disabledAdmin.firestore().doc("championshipEditions/ed-bozza").get());
  await assertFails(
    disabledAdmin.firestore().doc("championshipTypes/serie-c").set({
      id: "serie-c",
      name: "Serie C",
      hasTeams: true,
      badgeColor: "serie-c",
    })
  );
  await assertFails(
    disabledAdmin.firestore().collection("homeNews").add({
      title: "News non ammessa",
      body: "Testo",
      date: "2026-07-25",
      status: "pubblicato",
    })
  );
});

test("solo il superAdmin puo leggere le impostazioni notifiche", async () => {
  await seedBaseData();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("notificationSettings/global").set({ globalEnabled: true });
  });
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  const admin = testEnv.authenticatedContext("admin-uid");
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(superAdmin.firestore().doc("notificationSettings/global").get());
  await assertFails(admin.firestore().doc("notificationSettings/global").get());
  await assertFails(anon.firestore().doc("notificationSettings/global").get());
});

test("token notifiche e analytics non sono scrivibili direttamente dal client", async () => {
  await seedBaseData();
  const anon = testEnv.unauthenticatedContext();
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");

  await assertFails(anon.firestore().doc("notificationInstallations/install-1234567890123456").set({ token: "x" }));
  await assertFails(
    superAdmin.firestore().doc("notificationInstallations/install-1234567890123456/tokens/t1").set({ token: "x" })
  );
  await assertFails(anon.firestore().collection("analyticsEvents").add({ eventType: "page_view" }));
});

test("solo il superAdmin puo leggere history notifiche e analytics aggregati", async () => {
  await seedBaseData();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("notificationHistory/h1").set({ status: "sent", createdAt: "2026-07-25" });
    await ctx.firestore().doc("analyticsDaily/2026-07-25").set({ day: "2026-07-25", eventsTotal: 1 });
  });
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  const admin = testEnv.authenticatedContext("admin-uid");

  await assertSucceeds(superAdmin.firestore().doc("notificationHistory/h1").get());
  await assertSucceeds(superAdmin.firestore().doc("analyticsDaily/2026-07-25").get());
  await assertFails(admin.firestore().doc("notificationHistory/h1").get());
  await assertFails(admin.firestore().doc("analyticsDaily/2026-07-25").get());
});
test("il pubblico legge solo tornei visibili in corso o conclusi e i relativi gironi", async () => {
  await seedBaseData();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("tournaments/pubblico").set({ name: "Open", status: "in_corso", isPubliclyVisible: true });
    await db.doc("tournaments/bozza").set({ name: "Bozza", status: "bozza", isPubliclyVisible: true });
    await db.doc("tournaments/nascosto").set({ name: "Privato", status: "in_corso", isPubliclyVisible: false });
    await db.doc("tournamentGroups/g1").set({ tournamentId: "pubblico", name: "Girone A", order: 0 });
    await db.doc("tournamentGroups/g2").set({ tournamentId: "nascosto", name: "Girone B", order: 0 });
  });
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(anon.doc("tournaments/pubblico").get());
  await assertSucceeds(anon.doc("tournamentGroups/g1").get());
  await assertFails(anon.doc("tournaments/bozza").get());
  await assertFails(anon.doc("tournaments/nascosto").get());
  await assertFails(anon.doc("tournamentGroups/g2").get());
});

test("Admin e Super Admin leggono le bozze torneo ma nessuno scrive direttamente", async () => {
  await seedBaseData();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("tournaments/bozza").set({ name: "Bozza", status: "bozza", isPubliclyVisible: false });
  });
  const admin = testEnv.authenticatedContext("admin-uid").firestore();
  const superAdmin = testEnv.authenticatedContext("superadmin-uid").firestore();
  await assertSucceeds(admin.doc("tournaments/bozza").get());
  await assertSucceeds(superAdmin.doc("tournaments/bozza").get());
  await assertFails(admin.doc("tournaments/bozza").update({ name: "Manomesso" }));
  await assertFails(superAdmin.doc("tournaments/bozza").update({ name: "Manomesso" }));
});
