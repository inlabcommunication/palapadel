export function getNewsImageAlt(title: string, imageAlt?: string | null) {
  const explicitAlt = imageAlt?.trim();
  if (explicitAlt) return explicitAlt;
  const safeTitle = title.trim() || "notizia PalaPadel";
  return `Immagine della notizia: ${safeTitle}`;
}

export function getNewsExcerpt(body: string, maxLength = 130) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function buildHomeNewsImageFolder(newsId: string) {
  return `home-news/${newsId}/cover`;
}
