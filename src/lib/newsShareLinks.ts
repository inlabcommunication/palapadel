// Link di condivisione delle PalaPadel News (funzioni pure, senza dipendenze).

/** Indirizzo della singola news: chi lo apre trova proprio quell'articolo. */
export function getNewsShareUrl(newsId: string, origin = window.location.origin): string {
  return `${origin}/news/${encodeURIComponent(newsId)}`;
}

export function getWhatsAppShareUrl(title: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
}

export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}
