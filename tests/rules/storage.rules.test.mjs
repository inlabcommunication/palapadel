// Test reali delle Storage Rules tramite Storage Emulator + @firebase/rules-unit-testing.
// Richiede l'emulatore Storage in esecuzione (npm run test:rules avvia entrambi gli
// emulatori Firestore e Storage tramite `firebase emulators:exec`).

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";

const PROJECT_ID = "palapadel-rules-test";
let testEnv;

// Un JPEG 1x1 valido (bytes minimi), sufficiente per superare la validazione contentType.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
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
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("users/admin-uid").set({ uid: "admin-uid", role: "admin" });
    await ctx.firestore().doc("users/superadmin-uid").set({ uid: "superadmin-uid", role: "superadmin" });
    await ctx.firestore().doc("users/gestore-uid").set({ uid: "gestore-uid", role: "gestore" });
    await ctx.firestore().doc("users/disabled-admin-uid").set({ uid: "disabled-admin-uid", role: "admin", disabled: true });
    await ctx.firestore().doc("homeNews/news-pub").set({ title: "Pubblica", body: "Testo", status: "pubblicato", date: "2026-07-25" });
    await ctx.firestore().doc("homeNews/news-draft").set({ title: "Bozza", body: "Testo", status: "bozza", date: "2026-07-25" });
    await ctx.firestore().doc("homeNews/news-disabled").set({ title: "Disattivata", body: "Testo", status: "pubblicato", active: false });
  });
});

test("il pubblico può leggere una foto squadra", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.storage().ref("teams/t1/team-photo/photo.jpg").getDownloadURL());
});

test("un admin NON puo caricare una foto squadra JPEG", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(
    admin.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
});


test("un superAdmin puo caricare una foto squadra valida", async () => {
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  await assertSucceeds(
    superAdmin.storage().ref("teams/t1/team-photo/photo.webp").put(TINY_JPEG, { contentType: "image/webp" })
  );
});

test("un admin puo eliminare una foto squadra esistente", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(admin.storage().ref("teams/t1/team-photo/photo.jpg").delete());
});
test("un resultManager NON può caricare una foto squadra", async () => {
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(
    gestore.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
});

test("un account admin disabled NON puo caricare foto squadra", async () => {
  const disabledAdmin = testEnv.authenticatedContext("disabled-admin-uid");
  await assertFails(
    disabledAdmin.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
});

test("il pubblico puo leggere l'immagine di una news pubblicata", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("home-news/news-pub/cover/cover.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.storage().ref("home-news/news-pub/cover/cover.jpg").getDownloadURL());
});

test("il pubblico NON puo leggere l'immagine di una news in bozza", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("home-news/news-draft/cover/cover.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.storage().ref("home-news/news-draft/cover/cover.jpg").getDownloadURL());
});

test("il pubblico NON puo leggere l'immagine di una news disattivata", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("home-news/news-disabled/cover/cover.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.storage().ref("home-news/news-disabled/cover/cover.jpg").getDownloadURL());
});

test("solo il superAdmin puo caricare immagini news valide", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  await assertFails(
    admin.storage().ref("home-news/news-pub/cover/admin.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
  await assertSucceeds(
    superAdmin.storage().ref("home-news/news-pub/cover/super.webp").put(TINY_JPEG, { contentType: "image/webp" })
  );
});

test("resultManager, anonimo e admin disabled NON possono caricare immagini news", async () => {
  const gestore = testEnv.authenticatedContext("gestore-uid");
  const anon = testEnv.unauthenticatedContext();
  const disabledAdmin = testEnv.authenticatedContext("disabled-admin-uid");
  await assertFails(
    gestore.storage().ref("home-news/news-pub/cover/gestore.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
  await assertFails(
    anon.storage().ref("home-news/news-pub/cover/anon.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
  await assertFails(
    disabledAdmin.storage().ref("home-news/news-pub/cover/disabled.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
  );
});

test("un file con MIME non valido (es. PDF) viene rifiutato anche per l'admin", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertFails(
    admin.storage().ref("teams/t1/team-photo/doc.pdf").put(TINY_JPEG, { contentType: "application/pdf" })
  );
});

test("un file oltre 5 MB viene rifiutato anche per l'admin", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
  await assertFails(
    admin.storage().ref("teams/t1/team-photo/big.jpg").put(oversized, { contentType: "image/jpeg" })
  );
});

test("il pubblico puo leggere il logo di una tipologia di campionato", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("branding/championships/serie-b/logo/logo.png").put(TINY_JPEG, { contentType: "image/png" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.storage().ref("branding/championships/serie-b/logo/logo.png").getDownloadURL());
});

test("solo il superAdmin puo caricare il logo di una tipologia di campionato", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  const gestore = testEnv.authenticatedContext("gestore-uid");
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  await assertFails(
    admin.storage().ref("branding/championships/serie-b/logo/admin.png").put(TINY_JPEG, { contentType: "image/png" })
  );
  await assertFails(
    gestore.storage().ref("branding/championships/serie-b/logo/gestore.png").put(TINY_JPEG, { contentType: "image/png" })
  );
  await assertSucceeds(
    superAdmin.storage().ref("branding/championships/serie-b/logo/super.webp").put(TINY_JPEG, { contentType: "image/webp" })
  );
});

test("un admin disabled NON puo caricare o eliminare il logo di una tipologia", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("branding/championships/serie-b/logo/logo.png").put(TINY_JPEG, { contentType: "image/png" });
  });
  const disabledAdmin = testEnv.authenticatedContext("disabled-admin-uid");
  await assertFails(
    disabledAdmin.storage().ref("branding/championships/serie-b/logo/logo2.png").put(TINY_JPEG, { contentType: "image/png" })
  );
  await assertFails(disabledAdmin.storage().ref("branding/championships/serie-b/logo/logo.png").delete());
});

test("il logo di una tipologia rifiuta MIME non validi e file oltre 5 MB", async () => {
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
  await assertFails(
    superAdmin.storage().ref("branding/championships/serie-b/logo/doc.pdf").put(TINY_JPEG, { contentType: "application/pdf" })
  );
  await assertFails(
    superAdmin.storage().ref("branding/championships/serie-b/logo/big.png").put(oversized, { contentType: "image/png" })
  );
});

test("il pubblico puo leggere il logo InLab, ma solo il superAdmin puo caricarlo", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("branding/inlab/logo/logo.png").put(TINY_JPEG, { contentType: "image/png" });
  });
  const anon = testEnv.unauthenticatedContext();
  const admin = testEnv.authenticatedContext("admin-uid");
  const superAdmin = testEnv.authenticatedContext("superadmin-uid");
  await assertSucceeds(anon.storage().ref("branding/inlab/logo/logo.png").getDownloadURL());
  await assertFails(
    admin.storage().ref("branding/inlab/logo/admin.png").put(TINY_JPEG, { contentType: "image/png" })
  );
  await assertSucceeds(
    superAdmin.storage().ref("branding/inlab/logo/super.png").put(TINY_JPEG, { contentType: "image/png" })
  );
});
