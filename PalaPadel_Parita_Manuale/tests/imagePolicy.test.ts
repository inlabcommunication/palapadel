import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertValidImageFile,
  formatImageFileSize,
  makeStorageSafeFilename,
  MAX_IMAGE_UPLOAD_BYTES,
  StorageImageError,
} from "../src/lib/imageFilePolicy.ts";
import { buildHomeNewsImageFolder, getNewsExcerpt, getNewsImageAlt } from "../src/lib/homeNewsImagePolicy.ts";

test("la policy immagini accetta JPG, JPEG, PNG e WebP sotto i 5 MB", () => {
  for (const type of ["image/jpeg", "image/jpg", "image/png", "image/webp"]) {
    assert.doesNotThrow(() => assertValidImageFile({ type, size: MAX_IMAGE_UPLOAD_BYTES }));
  }
});

test("la policy immagini rifiuta formati non ammessi e file oltre 5 MB", () => {
  assert.throws(() => assertValidImageFile({ type: "application/pdf", size: 1200 }), StorageImageError);
  assert.throws(() => assertValidImageFile({ type: "image/jpeg", size: MAX_IMAGE_UPLOAD_BYTES + 1 }), StorageImageError);
});

test("i nomi file Storage vengono normalizzati senza caratteri rischiosi", () => {
  assert.equal(makeStorageSafeFilename("Foto Squadra Caffe!.PNG"), "foto-squadra-caffe.png");
  assert.equal(makeStorageSafeFilename(""), "immagine.jpg");
});

test("alt text e percorso Storage delle news rispettano il contratto richiesto", () => {
  assert.equal(getNewsImageAlt("Finale Serie B", ""), "Immagine della notizia: Finale Serie B");
  assert.equal(getNewsImageAlt("Finale Serie B", "Giocatori in campo"), "Giocatori in campo");
  assert.equal(buildHomeNewsImageFolder("news123"), "home-news/news123/cover");
});

test("l'estratto news compatta gli spazi e tronca in modo stabile", () => {
  assert.equal(getNewsExcerpt("Uno   due\n tre", 20), "Uno due tre");
  assert.equal(getNewsExcerpt("1234567890 1234567890", 12), "1234567890...");
});
