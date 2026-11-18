// Pagina di una singola news (/news/:id, vedi vercel.json). Restituisce l'app normale
// (index.html) con in più i meta Open Graph della news, così il link condiviso su
// WhatsApp, Facebook, Telegram... mostra titolo, testo e immagine dell'articolo.
// Se la news non esiste o non è pubblica, restituisce l'app senza meta aggiuntivi.

import { getAdminApp, admin } from "../_lib/firebaseAdmin.js";
import { injectNewsMeta, isPublicNewsData } from "../_lib/newsSocial.js";

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  const host = firstValue(req.headers["x-forwarded-host"]) || req.headers.host;
  const origin = `https://${host}`;
  const id = String(firstValue(req.query?.id) ?? "");

  let html;
  try {
    const response = await fetch(`${origin}/index.html`);
    if (!response.ok) throw new Error(`index.html ${response.status}`);
    html = await response.text();
  } catch (err) {
    console.error("share-page: index.html non disponibile", err);
    // L'app apre comunque la news giusta dal parametro ?news=.
    res.writeHead(302, { Location: /^[^/]{1,200}$/.test(id) ? `/news?news=${encodeURIComponent(id)}` : "/news" }).end();
    return;
  }

  if (/^[^/]{1,200}$/.test(id)) {
    try {
      const snap = await admin.firestore(getAdminApp()).doc(`homeNews/${id}`).get();
      const news = snap.exists ? snap.data() : null;
      if (isPublicNewsData(news)) {
        html = injectNewsMeta(html, {
          title: news.title,
          description: news.body,
          imageUrl: news.imageUrl || `${origin}/icon-512.png`,
          url: `${origin}/news/${encodeURIComponent(id)}`,
        });
      }
    } catch (err) {
      console.error("share-page: lettura news non riuscita", err);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
}
