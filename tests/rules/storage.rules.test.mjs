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
  });
});

test("il pubblico può leggere una foto squadra", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" });
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.storage().ref("teams/t1/team-photo/photo.jpg").getDownloadURL());
});

test("un admin può caricare una foto squadra JPEG valida sotto il limite di dimensione", async () => {
  const admin = testEnv.authenticatedContext("admin-uid");
  await assertSucceeds(
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
  await assertSucceeds(admin.storage().ref("teams/t1/team-photo/photo.jpg").delete());
});
test("un resultManager NON può caricare una foto squadra", async () => {
  const gestore = testEnv.authenticatedContext("gestore-uid");
  await assertFails(
    gestore.storage().ref("teams/t1/team-photo/photo.jpg").put(TINY_JPEG, { contentType: "image/jpeg" })
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
