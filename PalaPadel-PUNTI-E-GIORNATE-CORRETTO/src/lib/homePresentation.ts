import type { HomeNews } from "../types";

export const HOME_SECTION_ORDER = ["hero", "news", "championships", "albo"] as const;
export const HOME_NEWS_TITLE = "PALA PADEL NEWS";
export const HOME_NEWS_SUBTITLE = "Risultati, aggiornamenti e novità dal mondo PalaPadel.";

export function isPublicNews(item: HomeNews, now = new Date()): boolean {
  const publishedAt = item.publishedAt ?? item.date;
  const publishedTime = new Date(publishedAt).getTime();
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

export function getPublishedNewsForHome(news: HomeNews[], now = new Date()): HomeNews[] {
  return news
    .filter((item) => isPublicNews(item, now))
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.date).getTime() -
        new Date(a.publishedAt ?? a.date).getTime()
    );
}
