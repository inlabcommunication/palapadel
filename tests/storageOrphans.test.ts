import { test } from "node:test";
import assert from "node:assert/strict";
import { findOrphanStoragePaths, ORPHAN_MIN_AGE_MS } from "../server/_lib/storageOrphans.js";

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
