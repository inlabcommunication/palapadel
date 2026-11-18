import { getInstallationId } from "./installationId";

// "Mi piace" e condivisione delle PalaPadel News (senza login).

const LIKED_KEY = "palapadel.likedNews";

function readLiked(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeLiked(ids: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    // Browser senza memoria (navigazione privata): il mi piace resta salvato sul server.
  }
}

/** Questo dispositivo ha già messo mi piace alla news? (ricordato nel browser) */
export function hasLikedNews(newsId: string): boolean {
  return readLiked().has(newsId);
}

/**
 * Salva il mi piace (o lo toglie). Ritorna il nuovo totale dal server, oppure null se il
 * server non l'ha conteggiato (es. anteprima di prova).
 */
export async function setNewsLike(newsId: string, liked: boolean): Promise<number | null> {
  const ids = readLiked();
  if (liked) ids.add(newsId);
  else ids.delete(newsId);
  writeLiked(ids);

  let installationId: string;
  try {
    installationId = getInstallationId();
  } catch {
    throw new Error("Il browser non permette di salvare il mi piace.");
  }
  const response = await fetch("/api/home-news/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newsId, installationId, liked }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Ripristina lo stato locale se il server ha rifiutato.
    const rollback = readLiked();
    if (liked) rollback.delete(newsId);
    else rollback.add(newsId);
    writeLiked(rollback);
    throw new Error(typeof data?.error === "string" ? data.error : "Mi piace non salvato, riprova.");
  }
  return typeof data.likeCount === "number" ? data.likeCount : null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
