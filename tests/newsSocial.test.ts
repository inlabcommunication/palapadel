import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, injectNewsMeta, isAllowedCoverUrl, isPublicNewsData, newsLikeDocId } from "../server/_lib/newsSocial.js";
import { getFacebookShareUrl, getNewsShareUrl, getWhatsAppShareUrl } from "../src/lib/newsShareLinks.ts";
import { wrapText } from "../src/lib/newsStoryImage.ts";

const html = `<!doctype html><html><head><meta name="description" content="Campionati e classifiche del PalaPadel" /><title>PalaPadel — Campionati e classifiche</title></head><body><div id="root"></div></body></html>`;

test("l'anteprima del link usa titolo, testo e immagine della news, con caratteri protetti", () => {
  const out = injectNewsMeta(html, {
    title: 'Finale "Serie A" <stasera>',
    description: "Tutti in campo & buon divertimento",
    imageUrl: "https://example.com/foto.png?a=1&b=2",
    url: "https://app.example/news/abc",
  });
  assert.match(out, /<title>Finale &quot;Serie A&quot; &lt;stasera&gt; — PalaPadel<\/title>/);
  assert.match(out, /<meta property="og:title" content="Finale &quot;Serie A&quot; &lt;stasera&gt;" \/>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/example.com\/foto.png\?a=1&amp;b=2" \/>/);
  assert.match(out, /<meta name="description" content="Tutti in campo &amp; buon divertimento" \/>/);
  assert.match(out, /<meta property="og:url" content="https:\/\/app.example\/news\/abc" \/>/);
  assert.ok(!out.includes("<stasera>"));
  assert.equal(escapeHtml(`<a href='x'>`), "&lt;a href=&#39;x&#39;&gt;");
});

test("mi piace e anteprima solo per le news pubbliche", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  assert.equal(isPublicNewsData({ status: "pubblicato", date: "2026-11-01" }, now), true);
  assert.equal(isPublicNewsData({ status: "bozza", date: "2026-11-01" }, now), false);
  assert.equal(isPublicNewsData({ status: "pubblicato", date: "2026-11-01", isActive: false }, now), false);
  assert.equal(isPublicNewsData({ status: "pubblicato", date: "2026-11-01", deletedAt: "2026-11-02" }, now), false);
  assert.equal(isPublicNewsData({ status: "pubblicato", date: "2026-12-01" }, now), false);
  assert.equal(isPublicNewsData({ status: "pubblicato", date: "2026-11-01", expiresAt: "2026-11-10" }, now), false);
  assert.equal(isPublicNewsData(null, now), false);
  assert.equal(newsLikeDocId("news1", "abcdef0123456789"), "news1__abcdef0123456789");
});

test("link di condivisione della singola news", () => {
  const url = getNewsShareUrl("abc 1", "https://app.example");
  assert.equal(url, "https://app.example/news/abc%201");
  assert.equal(getWhatsAppShareUrl("Ciao & benvenuti", url), `https://wa.me/?text=${encodeURIComponent(`Ciao & benvenuti\n${url}`)}`);
  assert.equal(getFacebookShareUrl(url), `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
});

test("il testo dell'immagine per le Storie va a capo e si tronca con i puntini", () => {
  const measure = (text: string) => text.length * 10;
  assert.deepEqual(wrapText(measure, "uno due tre quattro", 100, 3), ["uno due", "tre", "quattro"]);
  const lines = wrapText(measure, "uno due tre quattro cinque sei sette otto", 80, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("…"));
  assert.ok(lines.every((line) => measure(line) <= 80));
});

test("la copertina passa dal server solo se è su Firebase/Google Storage", () => {
  assert.equal(isAllowedCoverUrl("https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/news%2Fa.jpg?alt=media&token=t"), true);
  assert.equal(isAllowedCoverUrl("https://storage.googleapis.com/x.appspot.com/news/a.jpg"), true);
  assert.equal(isAllowedCoverUrl("http://firebasestorage.googleapis.com/a.jpg"), false);
  assert.equal(isAllowedCoverUrl("https://example.com/a.jpg"), false);
  assert.equal(isAllowedCoverUrl("https://firebasestorage.googleapis.com.evil.com/a.jpg"), false);
  assert.equal(isAllowedCoverUrl(undefined), false);
});
