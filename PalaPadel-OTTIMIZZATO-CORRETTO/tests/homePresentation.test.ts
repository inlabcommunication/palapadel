import { test } from "node:test";
import assert from "node:assert/strict";
import { getPublishedNewsForHome, HOME_NEWS_SUBTITLE, HOME_NEWS_TITLE, HOME_SECTION_ORDER } from "../src/lib/homePresentation.ts";
import type { HomeNews } from "../src/types";

test("la Home mette le news prima dei campionati e poi l'Albo d'oro", () => {
  assert.deepEqual([...HOME_SECTION_ORDER], ["hero", "news", "championships", "albo"]);
});

test("la sezione news usa titolo e sottotitolo richiesti", () => {
  assert.equal(HOME_NEWS_TITLE, "PALA PADEL NEWS");
  assert.equal(HOME_NEWS_SUBTITLE, "Risultati, aggiornamenti e novità dal mondo PalaPadel.");
});

test("la Home mostra solo news pubblicate ordinate dalla piu recente", () => {
  const news: HomeNews[] = [
    { id: "old", title: "Old", body: "Testo visibile", date: "2026-01-02", status: "pubblicato" },
    { id: "draft", title: "Draft", body: "Non pubblicata", date: "2026-07-20", status: "bozza" },
    { id: "new", title: "New", body: "Testo visibile", date: "2026-07-21", status: "pubblicato" },
  ];

  assert.deepEqual(getPublishedNewsForHome(news).map((item) => item.id), ["new", "old"]);
});

test("la parte pubblica esclude news disattivate, eliminate, scadute o programmate", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const base: HomeNews = {
    id: "valid",
    title: "Valida",
    body: "Testo",
    date: "2026-07-25T10:00:00.000Z",
    status: "pubblicato",
  };
  const news: HomeNews[] = [
    base,
    { ...base, id: "inactive", isActive: false },
    { ...base, id: "deleted", deletedAt: "2026-07-25T11:00:00.000Z" },
    { ...base, id: "expired", expiresAt: "2026-07-25T11:00:00.000Z" },
    { ...base, id: "future", publishedAt: "2026-07-26T10:00:00.000Z" },
    { ...base, id: "draft", status: "bozza" },
  ];

  assert.deepEqual(getPublishedNewsForHome(news, now).map((item) => item.id), ["valid"]);
});
