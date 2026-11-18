// Regole condivise per "mi piace" e condivisione delle PalaPadel News.

/** Stessa regola di src/lib/homePresentation.ts (isPublicNews): solo news visibili al pubblico. */
export function isPublicNewsData(item, now = new Date()) {
  if (!item) return false;
  const publishedTime = new Date(item.publishedAt ?? item.date).getTime();
  const expiresTime = item.expiresAt ? new Date(item.expiresAt).getTime() : null;
  return (
    item.status === "pubblicato" &&
    item.isActive !== false &&
    !item.deletedAt &&
    Number.isFinite(publishedTime) &&
    publishedTime <= now.getTime() &&
    (expiresTime === null || !Number.isFinite(expiresTime) || expiresTime > now.getTime())
  );
}

/** Documento che ricorda il "mi piace" di un dispositivo a una news (uno per dispositivo). */
export function newsLikeDocId(newsId, installationId) {
  return `${newsId}__${installationId}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(text, max) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * Inserisce in index.html i meta Open Graph della news, così WhatsApp, Facebook e gli
 * altri mostrano titolo, testo e immagine nell'anteprima del link. Il resto della
 * pagina resta l'app normale.
 */
export function injectNewsMeta(html, { title, description, imageUrl, url }) {
  const safeTitle = escapeHtml(truncate(title, 110));
  const safeDescription = escapeHtml(truncate(description, 200));
  const tags = [
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="PalaPadel" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${safeTitle} — PalaPadel</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${safeDescription}" />`)
    .replace("</head>", `    ${tags}\n  </head>`);
}
