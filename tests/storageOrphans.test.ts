import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectStorageReferences,
  findOrphanStoragePaths,
  MAX_AUTO_ORPHANS,
  ORPHAN_MIN_AGE_MS,
  storagePathFromValue,
} from "../server/_lib/storageOrphans.js";

const now = Date.parse("2026-10-21T03:00:00.000Z");
const old = new Date(now - ORPHAN_MIN_AGE_MS - 1000).toISOString();
const recent = new Date(now - 10 * 60 * 1000).toISOString();
const file = (name: string, timeCreated?: string) => ({ name, metadata: timeCreated ? { timeCreated } : {} });

test("old unreferenced files in managed folders are orphans", () => {
  const files = [
    file("home-news/n1/cover/a.webp", old),
    file("teams/t1/team-photo/b.webp", old),
    file("other/c.png", old),
  ];
  assert.deepEqual(findOrphanStoragePaths(files, new Set(["teams/t1/team-photo/b.webp"]), ["home-news/", "teams/"], now), [
    "home-news/n1/cover/a.webp",
  ]);
});

test("files uploaded recently or with unknown date are never orphans", () => {
  const files = [file("home-news/n2/cover/new.webp", recent), file("home-news/n3/cover/x.webp")];
  assert.deepEqual(findOrphanStoragePaths(files, new Set(), ["home-news/"], now), []);
});

test("i riferimenti si leggono anche dagli URL e dai campi annidati", () => {
  const referenced = collectStorageReferences([
    { teamPhotoUrl: "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/teams%2Ft1%2Fteam-photo%2Ffoto.webp?alt=media&token=abc" },
    { imageStoragePath: "home-news/n1/cover/a.webp" },
    { logoUrl: "https://storage.googleapis.com/demo.appspot.com/championship-types/c1/logo/l.png" },
    { gallery: [{ src: "gs://demo.appspot.com/teams/t2/team-photo/b.webp" }] },
  ]);
  for (const path of [
    "teams/t1/team-photo/foto.webp",
    "home-news/n1/cover/a.webp",
    "championship-types/c1/logo/l.png",
    "teams/t2/team-photo/b.webp",
  ]) {
    assert.equal(referenced.has(path), true, path);
  }
});

test("una foto squadra salvata solo come URL non viene considerata orfana", () => {
  const files = [file("teams/t1/team-photo/foto.webp", old)];
  const referenced = collectStorageReferences([
    { name: "Padel Team", teamPhotoUrl: "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/teams%2Ft1%2Fteam-photo%2Ffoto.webp?alt=media" },
  ]);
  assert.deepEqual(findOrphanStoragePaths(files, referenced, ["teams/"], now), []);
});

test("storagePathFromValue ignora URL esterni", () => {
  assert.equal(storagePathFromValue("https://www.instagram.com/foto.jpg"), null);
  assert.equal(storagePathFromValue(""), null);
  assert.equal(MAX_AUTO_ORPHANS > 0, true);
});
